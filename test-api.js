// Test API connection
const API_KEY = 'AIzaSyAaQQXvwvdJKvmd4XjjR5oMgStvTYeDzBc';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

async function testAPI() {
  try {
    const testMessage = {
      contents: [
        {
          parts: [
            {
              text: "Hello, can you respond with just 'API connection successful'?"
            }
          ]
        }
      ]
    };

    console.log('Testing API connection...');
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage)
    });

    const data = await response.json();
    
    if (response.ok) {
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log('✅ API Response:', reply);
      console.log('API connection is working!');
    } else {
      console.error('❌ API Error:', data);
    }
  } catch (error) {
    console.error('❌ Connection Error:', error);
  }
}

testAPI();
