import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import DashboardWrapper from './dashboardWrapper'
import { ThemeProvider } from 'next-themes'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Склад',
  description: 'Iventory management system, owned by South_Geckoland',
  icons: {
    icon: '/favicon.ico',
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute='class'
          defaultTheme='system'
          enableSystem
          disableTransitionOnChange
        >
          <DashboardWrapper>{children}</DashboardWrapper>{' '}
        </ThemeProvider>
      </body>
    </html>
  )
}
