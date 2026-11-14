'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [status, setStatus] = useState<string>('Checking backend...');

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

    fetch(`${apiUrl}/health`)
      .then((res) => res.json())
      .then((data) => setStatus(`Connected! API status: ${data.status}`))
      .catch((err) => setStatus(`Failed to connect: ${err.message}`));
  }, []);

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>SipMunchYap</h1>
      <p>{status}</p>
    </main>
  );
}