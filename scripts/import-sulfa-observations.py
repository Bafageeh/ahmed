#!/usr/bin/env python3
"""Apply an explicit, private Sulfa observation plan without replacing history."""
import argparse
import hashlib
import json
import os
import sqlite3


UPDATE_FIELDS = {
    'sulfa_investment_entries': {
        'repayment_progress_percent', 'portfolio_snapshot_date', 'updated_at',
        'platform_status', 'is_active', 'status',
    },
    'sulfa_investments': {'invested_amount', 'updated_at'},
}
IDENTITIES = {
    'sulfa_investment_transactions': {
        'user_id', 'transaction_type', 'opportunity_number', 'transaction_date', 'amount',
    },
    'sulfa_portfolio_snapshots': {'user_id', 'snapshot_date', 'source'},
    'sulfa_account_snapshots': {'user_id', 'snapshot_date', 'source'},
}
TABLES = set(UPDATE_FIELDS) | set(IDENTITIES)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def quoted(name):
    return '"' + name.replace('"', '""') + '"'


def rows(conn, table):
    return [dict(r) for r in conn.execute('SELECT * FROM ' + quoted(table) + ' ORDER BY rowid')]


def fingerprint(value):
    raw = json.dumps(value, sort_keys=True, ensure_ascii=True, default=str).encode('utf-8')
    return hashlib.sha256(raw).hexdigest()


def find(conn, table, identity):
    keys = sorted(identity)
    where = ' AND '.join(quoted(k) + ' IS ?' for k in keys)
    return [dict(r) for r in conn.execute(
        'SELECT * FROM ' + quoted(table) + ' WHERE ' + where,
        [identity[k] for k in keys],
    )]


def private_write(path, body):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'w') as stream:
            stream.write(body)
    except Exception:
        try:
            os.close(fd)
        except OSError:
            pass
        raise


def apply(conn, plan, backup=None, verify=False):
    require(plan.get('version') == 1, 'Unsupported plan version')
    uid = plan.get('user_id')
    require(isinstance(uid, int) and uid > 0, 'Missing account scope')
    conn.execute('PRAGMA foreign_keys=ON')
    conn.execute('BEGIN IMMEDIATE' if not verify else 'BEGIN')
    try:
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )]
        before = {t: rows(conn, t) for t in tables if t in TABLES}
        untouched = {t: fingerprint(rows(conn, t)) for t in tables if t not in TABLES}
        schemas = {t: {r[1] for r in conn.execute('PRAGMA table_info(' + quoted(t) + ')')} for t in TABLES}
        if backup and not verify and not os.path.exists(backup):
            private_write(backup, '\n'.join(conn.iterdump()) + '\n')
        expected = {t: {r['id']: r for r in data} for t, data in before.items()}
        counts = {'updated': 0, 'inserted': 0, 'already_present': 0}
        for change in plan['updates']:
            table, fields, old = change['table'], change['fields'], change['before']
            require(table in UPDATE_FIELDS, 'Table is not updatable')
            require(set(fields) <= UPDATE_FIELDS[table], 'Unapproved update column')
            require(old['user_id'] == uid and old['id'] == change['id'], 'Update outside account')
            current = find(conn, table, {'id': old['id'], 'user_id': uid})
            require(len(current) == 1, 'Guarded update target is missing')
            after = dict(old, **fields)
            if current[0] == after:
                counts['already_present'] += 1
            else:
                require(not verify and current[0] == old, 'Guarded row changed since inspection')
                keys = sorted(fields)
                conn.execute('UPDATE ' + quoted(table) + ' SET ' + ','.join(quoted(k) + '=?' for k in keys)
                             + ' WHERE id=? AND user_id=?', [fields[k] for k in keys] + [old['id'], uid])
                counts['updated'] += 1
            expected[table][old['id']] = after
        for change in plan['inserts']:
            table, identity, values = change['table'], change['identity'], change['values']
            require(table in IDENTITIES and set(identity) == IDENTITIES[table], 'Invalid insertion identity')
            require(identity['user_id'] == uid and values['user_id'] == uid, 'Insert outside account')
            require(set(values) <= schemas[table] and 'id' not in values, 'Invalid insertion columns')
            require(all(values[k] == v for k, v in identity.items()), 'Identity differs from record')
            require(values.get('source') == plan['source'], 'Missing observation provenance')
            current = find(conn, table, identity)
            require(len(current) <= 1, 'Ambiguous existing observation')
            if current:
                # An independently imported transaction with the same complete identity is retained.
                if table != 'sulfa_investment_transactions' or current[0].get('source') == plan['source']:
                    require(all(current[0][k] == v for k, v in values.items()), 'Conflicting existing observation')
                counts['already_present'] += 1
            else:
                require(not verify, 'Expected observation is missing')
                keys = sorted(values)
                cursor = conn.execute('INSERT INTO ' + quoted(table) + ' (' + ','.join(quoted(k) for k in keys)
                                      + ') VALUES (' + ','.join('?' for k in keys) + ')', [values[k] for k in keys])
                current = find(conn, table, {'id': cursor.lastrowid, 'user_id': uid})
                expected[table][cursor.lastrowid] = current[0]
                counts['inserted'] += 1
        for table, expected_rows in expected.items():
            actual = {r['id']: r for r in rows(conn, table)}
            require(actual == expected_rows, 'Unexpected change to Sulfa history')
        for table, digest in untouched.items():
            require(fingerprint(rows(conn, table)) == digest, 'Unrelated table changed')
        conn.commit()
        return counts
    except Exception:
        conn.rollback()
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', required=True)
    parser.add_argument('--plan', required=True)
    parser.add_argument('--backup')
    parser.add_argument('--verify-only', action='store_true')
    parser.add_argument('--result')
    args = parser.parse_args()
    with open(args.plan) as stream:
        plan = json.load(stream)
    conn = sqlite3.connect(args.database, timeout=30)
    conn.row_factory = sqlite3.Row
    result = apply(conn, plan, backup=args.backup, verify=args.verify_only)
    conn.close()
    if args.result:
        private_write(args.result, json.dumps(result))
    print('SULFA_IMPORT_VERIFIED' if args.verify_only else 'SULFA_IMPORT_APPLIED', json.dumps(result, sort_keys=True))


if __name__ == '__main__':
    main()
