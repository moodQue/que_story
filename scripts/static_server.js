const fs = require("fs");
const http = require("http");
const path = require("path");

const root = process.cwd();
const port = Number(process.env.PORT || process.argv[2] || 4173);
const types = {
  ".css": "text/css",
  ".html": "text/html",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".xml": "application/xml",
};

http
  .createServer((request, response) => {
    let urlPath = decodeURIComponent(request.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";

    const filePath = path.normalize(path.join(root, urlPath));
    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "Content-Type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      });
      response.end(data);
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Que site: http://127.0.0.1:${port}`);
  });
