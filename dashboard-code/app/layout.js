import './globals.css'
import { AuthProvider } from './context/AuthContext'

export const metadata = {
  title: 'Content Briefs Dashboard',
  description: 'Dashboard for viewing and managing content briefs from MongoDB',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
