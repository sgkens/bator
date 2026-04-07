import { Endpoint, CodeGenerator } from '../types';

const generators: Record<string, CodeGenerator> = {
  curl: {
    language: 'curl',
    generate: (endpoint: Endpoint) => {
      const { method, path } = endpoint;
      const baseUrl = 'http://localhost:3000';
      return `curl -X ${method} "${baseUrl}${path}" \\
  -H "Content-Type: application/json"`;
    }
  },
  javascript: {
    language: 'javascript',
    generate: (endpoint: Endpoint) => {
      const { method, path } = endpoint;
      const baseUrl = 'http://localhost:3000';
      return `fetch("${baseUrl}${path}", {
  method: "${method}",
  headers: {
    "Content-Type": "application/json"
  }
})
.then(response => response.json())
.then(data => console.log(data));`;
    }
  },
  axios: {
    language: 'axios',
    generate: (endpoint: Endpoint) => {
      const { method, path } = endpoint;
      const baseUrl = 'http://localhost:3000';
      return `import axios from 'axios';

axios({
  method: "${method.toLowerCase()}",
  url: "${baseUrl}${path}",
  headers: {
    "Content-Type": "application/json"
  }
})
.then(response => {
  console.log(response.data);
});`;
    }
  },
  python: {
    language: 'python',
    generate: (endpoint: Endpoint) => {
      const { method, path } = endpoint;
      const baseUrl = 'http://localhost:3000';
      return `import requests

response = requests.${method.toLowerCase()}("${baseUrl}${path}")
print(response.json())`;
    }
  }
};

export const generateCode = (endpoint: Endpoint, language: string): string => {
  const generator = generators[language];
  return generator ? generator.generate(endpoint) : '';
};

export const getAvailableLanguages = () => Object.keys(generators);

export const registerGenerator = (generator: CodeGenerator) => {
  generators[generator.language] = generator;
};
