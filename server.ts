import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import { faker } from "@faker-js/faker";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // In-memory store for Bator project configuration
  let projectConfig = {
    tables: [],
    relations: [],
    endpoints: [],
    middleware: [],
    logs: [],
    clientRequests: [],
    environments: [
      { id: 'default', name: 'Global', variables: [{ key: 'base_url', value: 'https://jsonplaceholder.typicode.com' }] }
    ],
    vault: [],
    proxies: []
  };

  // API for the Bator UI to manage the mock environment
  app.get("/api/bator/config", (req, res) => {
    res.json(projectConfig);
  });

  app.post("/api/bator/config", (req, res) => {
    projectConfig = req.body;
    res.json({ status: "ok" });
  });

  app.get("/api/bator/logs", (req, res) => {
    res.json(projectConfig.logs);
  });

  app.delete("/api/bator/logs", (req, res) => {
    projectConfig.logs = [];
    res.json({ status: "ok" });
  });

  // Proxy endpoint for the API Client
  app.post("/api/proxy", async (req, res) => {
    const { method, url, headers, body, latency = 0 } = req.body;
    const startTime = Date.now();

    setTimeout(async () => {
      try {
        const axios = (await import("axios")).default;
        const response = await axios({
          method,
          url,
          headers,
          data: body,
          validateStatus: () => true, // Don't throw on error status codes
        });

        const duration = Date.now() - startTime;
        res.json({
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data,
          duration,
          size: JSON.stringify(response.data).length + " B",
        });
      } catch (error: any) {
        res.status(500).json({
          error: error.message,
          status: 500,
          duration: Date.now() - startTime,
        });
      }
    }, latency);
  });

  // Proxy Interceptor (sit between frontend and backend)
  app.all("/p/:proxyId/*", async (req, res) => {
    const { proxyId } = req.params;
    const proxy = projectConfig.proxies.find(p => p.id === proxyId);
    
    if (!proxy || !proxy.enabled) {
      return res.status(404).json({ error: "Proxy route not found or disabled" });
    }

    const subPath = req.path.replace(`/p/${proxyId}`, "");
    const targetUrl = `${proxy.target}${subPath}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;
    const startTime = Date.now();

    setTimeout(async () => {
      try {
        const axios = (await import("axios")).default;
        const response = await axios({
          method: req.method,
          url: targetUrl,
          headers: { ...req.headers, host: new URL(proxy.target).host },
          data: req.body,
          validateStatus: () => true,
        });

        const duration = Date.now() - startTime;
        
        // Log the intercepted request
        projectConfig.logs.push({
          id: Date.now().toString(),
          time: new Date().toISOString(),
          method: req.method,
          path: `[PROXY:${proxy.prefix}] ${subPath}`,
          status: response.status,
          duration,
          size: JSON.stringify(response.data).length + " B"
        });

        res.status(response.status).set(response.headers).send(response.data);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }, proxy.latency || 0);
  });

  // The Mock Server Logic
  // All requests starting with /mock will be handled by the user-defined endpoints
  app.all("/mock/*", (req, res) => {
    const mockPath = req.path.replace("/mock", "");
    const method = req.method;

    // Find matching endpoint
    const endpoint = projectConfig.endpoints.find(ep => {
      // Simple path matching (could be improved with regex for params)
      const epPath = ep.path.startsWith("/") ? ep.path : "/" + ep.path;
      return ep.method === method && (epPath === mockPath || mockPath.startsWith(epPath));
    });

    const logEntry = {
      id: Date.now().toString(),
      time: new Date().toISOString(),
      method,
      path: mockPath,
      status: 200,
      duration: Math.floor(Math.random() * 50),
      size: "0 B"
    };

    if (!endpoint) {
      logEntry.status = 404;
      projectConfig.logs.push(logEntry);
      return res.status(404).json({ error: "Endpoint not found in Bator configuration" });
    }

    // Simulate Latency
    const latency = endpoint.latency || 0;

    setTimeout(() => {
      // Generate Mock Data based on linked table or custom response
      let responseData = endpoint.response || { message: "Success" };

      if (endpoint.tableId) {
        const table = projectConfig.tables.find(t => t.id === endpoint.tableId);
        if (table) {
          // Generate fake data based on table schema
          const count = endpoint.method === 'GET' && !mockPath.includes('/:id') ? 10 : 1;
          const data = Array.from({ length: count }).map(() => {
            const item: any = {};
            table.fields.forEach((field: any) => {
              if (field.faker) {
                try {
                  // Basic support for faker strings like "faker.person.fullName"
                  const parts = field.faker.replace("faker.", "").split(".");
                  let fn: any = faker;
                  parts.forEach((p: string) => { fn = fn[p]; });
                  item[field.name] = typeof fn === 'function' ? fn() : fn;
                } catch (e) {
                  item[field.name] = "Error generating data";
                }
              } else {
                // Default generators
                if (field.type === 'uuid') item[field.name] = faker.string.uuid();
                else if (field.type === 'int') item[field.name] = faker.number.int();
                else if (field.type === 'decimal') item[field.name] = faker.number.float({ min: 0, max: 1000, fractionDigits: 2 });
                else if (field.type === 'boolean') item[field.name] = faker.datatype.boolean();
                else if (field.type === 'varchar') item[field.name] = faker.lorem.word();
                else if (field.type === 'timestamp') item[field.name] = faker.date.recent().toISOString();
                else item[field.name] = null;
              }
            });
            return item;
          });
          responseData = count === 1 ? data[0] : { data, total: 100, page: 1 };
        }
      }

      logEntry.status = 200;
      logEntry.size = JSON.stringify(responseData).length + " B";
      projectConfig.logs.push(logEntry);

      res.status(200).json(responseData);
    }, latency);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Bator Server running on http://localhost:${PORT}`);
  });
}

startServer();
