import type { NextApiRequest, NextApiResponse } from 'next';
import { PineconeClient } from '@pinecone-database/pinecone';

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_ASSISTANT_NAME = process.env.PINECONE_ASSISTANT_NAME;
const PINECONE_ASSISTANT_URL = process.env.PINECONE_ASSISTANT_URL;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      console.error('Invalid messages format:', messages);
      res.status(400).json({ error: 'Invalid messages format. Expected an array.' });
      return;
    }

    const response = await fetch(`${PINECONE_ASSISTANT_URL}/${PINECONE_ASSISTANT_NAME}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': PINECONE_API_KEY,
      },
      body: JSON.stringify({ messages }),
    });

    const data = await response.json();

    if (response.ok) {
      res.status(200).json(data);
    } else {
      console.error('Error from Pinecone assistant API:', data.error);
      res.status(response.status).json({ error: data.error || 'An error occurred while communicating with the Pinecone assistant.' });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'An error occurred while processing the request.' });
  }
}
