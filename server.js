import http from 'node:http';
import {readFile} from 'node:fs/promises';
const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/core.js':'core.js','/task-extras.js':'task-extras.js','/style.css':'style.css','/feedback.js':'feedback.js','/cloud.js':'cloud.js','/cloud-config.js':'cloud-config.js'};
http.createServer(async(req,res)=>{const path=files[new URL(req.url,'http://localhost').pathname];if(!path){res.writeHead(404);return res.end();}try{const body=await readFile(new URL('./dist/'+path,import.meta.url));res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(body);}catch{res.writeHead(500);res.end();}}).listen(4173,'127.0.0.1',()=>console.log('http://127.0.0.1:4173'));
