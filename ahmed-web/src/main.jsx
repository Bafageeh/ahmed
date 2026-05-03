import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

function App() {
  const [api, setApi] = useState('جاري فحص الاتصال بالـ API...')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setApi(data.ok ? 'API متصل بنجاح' : 'API غير جاهز'))
      .catch(() => setApi('تعذر الاتصال بالـ API'))
  }, [])

  return (
    <main className="page">
      <section className="card">
        <div className="badge">Ahmed Platform</div>
        <h1>مشروع أحمد</h1>
        <p>تم تجهيز نسخة الويب والـ API وتطبيق الجوال Native.</p>

        <div className="grid">
          <div>
            <strong>Web</strong>
            <span>جاهز على ahmed.pm.sa</span>
          </div>
          <div>
            <strong>API</strong>
            <span>{api}</span>
          </div>
          <div>
            <strong>Mobile Native</strong>
            <span>جاهز للتشغيل عبر Expo</span>
          </div>
        </div>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
