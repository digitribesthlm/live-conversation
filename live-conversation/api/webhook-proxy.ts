import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { webhookUrl, body, action } = req.body;

  if (!webhookUrl) {
    return res.status(400).json({ error: 'webhookUrl is required' });
  }

  try {
    console.log(`Proxying webhook call to: ${webhookUrl}`);
    console.log(`Action: ${action}, Body:`, body);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body || { value: action }),
    });

    const data = await response.json();
    console.log('Webhook response:', data);

    // Add CORS headers to the response
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    return res.status(200).json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error('Webhook proxy error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

