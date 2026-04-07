import { Endpoint } from '../types';

export const generateCode = (endpoint: Endpoint, language: string): string => {
  const { method, path } = endpoint;
  const baseUrl = 'http://localhost:3000';
  const fullUrl = `${baseUrl}${path}`;

  switch (language) {
    case 'curl':
      return `curl -X ${method} "${fullUrl}" \\
  -H "Content-Type: application/json"`;
    
    case 'javascript':
      return `fetch("${fullUrl}", {
  method: "${method}",
  headers: {
    "Content-Type": "application/json"
  }
})
.then(response => response.json())
.then(data => console.log(data));`;

    case 'axios':
      return `import axios from 'axios';

axios({
  method: "${method.toLowerCase()}",
  url: "${fullUrl}",
  headers: {
    "Content-Type": "application/json"
  }
})
.then(response => {
  console.log(response.data);
});`;

    case 'python':
      return `import requests

response = requests.${method.toLowerCase()}("${fullUrl}")
print(response.json())`;

    default:
      return '';
  }
};
