import { ImageResponse } from 'next/og'
import { siteConfig } from '@/lib/seo'

export const runtime = 'edge'

export const alt = 'SprintRoom - Focus-powered task management for teams'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(to bottom right, #fcfcfd, #f8f9fc)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        <div
            style={{
                position: 'absolute',
                top: 60,
                left: 60,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
            }}
        >
            <div style={{ background: '#2563EB', width: 40, height: 40, borderRadius: 8 }}></div>
            <span style={{ fontSize: 32, fontWeight: 800, color: '#101828' }}>SprintRoom</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: 800 }}>
          <h1
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: '#101828',
              lineHeight: 1.1,
              marginBottom: 24,
              letterSpacing: '-0.04em',
            }}
          >
            Watch work move.
          </h1>
          <p
            style={{
              fontSize: 32,
              color: '#475467',
              marginBottom: 48,
              fontWeight: 500,
            }}
          >
            Focus-powered task management for teams.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          {['Pomodoro', 'Tasks', 'Blockers', 'Team Pulse'].map((label) => (
            <div
              key={label}
              style={{
                background: '#fff',
                border: '1px solid #e4e7ec',
                padding: '8px 20px',
                borderRadius: 100,
                fontSize: 18,
                fontWeight: 600,
                color: '#344054',
                boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)',
              }}
            >
              {label}
            </div>
          ))}
        </div>

        <div
            style={{
                position: 'absolute',
                bottom: 60,
                right: 60,
                fontSize: 18,
                color: '#98a2b3',
                fontWeight: 500,
            }}
        >
            sprintroom.com
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
