export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(to bottom, #f0f0f0, #e0e0e0)',
      }}
    >
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          🚀 Welcome to Your Project
        </h1>
        <p style={{ fontSize: '1.25rem', color: '#666', marginBottom: '2rem' }}>
          Built with Next.js 15, React 19, and deployed on Kubernetes
        </p>
        <div
          style={{
            display: 'inline-block',
            padding: '2rem',
            border: '1px solid #ddd',
            borderRadius: '8px',
            background: 'white',
          }}
        >
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            ✅ Ready to Deploy
          </h2>
          <p style={{ color: '#666' }}>Your application is running successfully!</p>
        </div>
      </div>
    </main>
  )
}
