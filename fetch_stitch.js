import fs from 'fs';

async function download(url, filename) {
    const res = await fetch(url);
    const text = await res.text();
    fs.writeFileSync(filename, text);
    console.log(`Downloaded ${filename}`);
}

const inventoryUrl = "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2U2MmRhYjE5NjQ5YjQwMjY5NWE4YzMyNjZmMzNmYmIxEgsSBxD1t-y8hQsYAZIBJAoKcHJvamVjdF9pZBIWQhQxMDUwNTk3MzgzMzI0OTE1OTEwOA&filename=&opi=89354086";
const homeUrl = "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2M0ZjlmYzFkZDM5YzRhODY5NGQ2YzM0YTZiM2Y3ZTYxEgsSBxD1t-y8hQsYAZIBJAoKcHJvamVjdF9pZBIWQhQxMDUwNTk3MzgzMzI0OTE1OTEwOA&filename=&opi=89354086";

async function run() {
    await download(inventoryUrl, 'stitch_inventory.html');
    await download(homeUrl, 'stitch_home.html');
}

run();
