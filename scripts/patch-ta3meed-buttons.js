const fs = require('fs');
const path = require('path');

const compactPath = path.join(__dirname, '..', 'ahmed-mobile', 'Ta3meedCompactFiltersScreen.js');
const wrapperPath = path.join(__dirname, '..', 'ahmed-mobile', 'Ta3meedNoResetFilterScreen.js');

let compact = fs.readFileSync(compactPath, 'utf8');

compact = compact.replace(
  /<CompactFilter label="المستثمر" value=\{investorLabel\} onPress=\{\(\) => onOpenMore \? onOpenMore\(\) : onBack\?\.\(\)\} \/>/g,
  '<CompactFilter label="المستثمر" value={investorLabel} onPress={() => setPicker(\'investor\')} />'
);

compact = compact.replace(
  /style=\{styles\.investorFloatingButton\}/g,
  'style={styles.moreFloatingButton}'
);

compact = compact.replace(
  /investorFloatingButton:\s*\{/g,
  'moreFloatingButton: {'
);

fs.writeFileSync(compactPath, compact);

let wrapper = fs.readFileSync(wrapperPath, 'utf8');
wrapper = wrapper.replace(
  /screen = <Ta3meedCompactFiltersScreen key=\{screenKey\} \{\.\.\.props\} onOpenMore=\{openMore\} \/>;/g,
  'screen = <Ta3meedCompactFiltersScreen key={screenKey} {...props} onOpenMore={openMore} />;'
);
fs.writeFileSync(wrapperPath, wrapper);

console.log('Ta3meed buttons patched: investor filter opens investor picker, floating button opens More.');
