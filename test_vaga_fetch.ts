const run = async () => {
    const res = await fetch("https://api.vagalume.com.br/search.excerpt?q=Skillet&limit=5", {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "application/json"
        }
    });
    const txt = await res.text();
    console.log(res.status, txt.substring(0, 500));
}
run();
