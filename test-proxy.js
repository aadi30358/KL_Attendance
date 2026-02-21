const data = {
    prompt: "What is the 5-character alphanumeric code in this image? Respond ONLY with the code.",
    contents: [
        { text: "What is the 5-character alphanumeric code in this image? Respond ONLY with the code." },
        { inlineData: { data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", mimeType: "image/png" } }
    ],
    systemInstruction: "You are an expert captcha solver. Provide ONLY the 5 alphanumeric characters found in the image."
};

fetch('http://localhost:3000/api/ai/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
})
    .then(res => res.json().then(j => ({ status: res.status, json: j })))
    .then(console.log)
    .catch(console.error);
