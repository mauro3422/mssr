import {readFile,writeFile} from 'node:fs/promises';
const data=JSON.parse(await readFile(new URL('./results/latest.json',import.meta.url),'utf8'));
const template=await readFile(new URL('./report-template.html',import.meta.url),'utf8');
await writeFile(new URL('./public/index.html',import.meta.url),template.replace('/*BENCHMARK_DATA*/null',JSON.stringify(data).replaceAll('<','\\u003c')));
console.log('Informe español actualizado en http://127.0.0.1:8788');
