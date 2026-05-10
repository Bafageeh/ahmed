import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

function App() {
  const [api, setApi] = useState('جاري فحص الاتصال بالـ API...')
  const [ok, setOk] = useState(false)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setOk(Boolean(data.ok))
        setApi(data.ok ? 'API متصل بنجاح' : 'API غير جاهز')
      })
      .catch(() => {
        setOk(false)
        setApi('تعذر الاتصال بالـ API')
      })
  }, [])

  return (
    <main className="page">
      <div className="orb orb-one" />
      <div className="orb orb-two" />
      <section className="hero-card">
        <div className="hero-top">
          <div className="brand-mark">A</div>
          <div>
            <div className="badge">Ahmed Platform</div>
            <h1>مشروع أحمد</h1>
          </div>
        </div>
        <p className="lead">واجهة أجمل لإدارة ثروتي، الاستثمارات، التقارير، وربط Finance ضمن هوية ملونة وواضحة.</p>

        <div className="status-strip">
          <span className={ok ? 'pulse ok' : 'pulse'} />
          <strong>{api}</strong>
          <small>ahmed.pm.sa</small>
        </div>

        <div className="grid">
          <InfoCard title="ثروتي" text="ملخص ممتلكات أحمد وحصته في المنصات." tone="violet" />
          <InfoCard title="استثماراتي" text="تعميد، موني مون، دينار، وترميز." tone="cyan" />
          <InfoCard title="Finance" text="القيم مستوردة مباشرة ولا تحسب يدويًا." tone="amber" />
          <InfoCard title="التقارير" text="اختصارات ولوحات متابعة أكثر وضوحًا." tone="emerald" />
        </div>
      </section>
    </main>
  )
}

function InfoCard({ title, text, tone }) {
  return (
    <div className={`info-card ${tone}`}>
      <span />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
