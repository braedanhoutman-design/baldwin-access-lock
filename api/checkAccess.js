export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  const API_KEY = process.env.SQUARESPACE_API_KEY;
  const ACCESS_DAYS = 30;
  
  const { email } = req.query;
  
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  
  try {
    // Call Squarespace API
    const response = await fetch('https://api.squarespace.com/v1/commerce/orders?limit=200', {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Squarespace API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Find order matching this email (case-insensitive)
    const userOrder = data.orders.find(order => {
      const orderEmail = order.customerEmail || order.billingAddress?.email || '';
      return orderEmail.toLowerCase() === email.toLowerCase();
    });
    
    if (!userOrder) {
      return res.json({ hasAccess: false, message: 'No order found' });
    }
    
    // Check if paid
    if (!userOrder.paidAt) {
      return res.json({ hasAccess: false, message: 'Order not paid' });
    }
    
    // Calculate days elapsed since purchase
    const paidAt = new Date(userOrder.paidAt).getTime();
    const now = new Date().getTime();
    const daysElapsed = (now - paidAt) / (1000 * 60 * 60 * 24);
    
    const hasAccess = daysElapsed < ACCESS_DAYS;
    const daysRemaining = Math.max(0, Math.ceil(ACCESS_DAYS - daysElapsed));
    
    return res.json({
      hasAccess,
      daysRemaining,
      daysElapsed: Math.floor(daysElapsed),
      customerName: userOrder.customerName || 'User',
      paidAt: userOrder.paidAt
    });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
}
