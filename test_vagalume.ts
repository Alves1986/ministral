const run = async () => {
    try {
        const res = await fetch("https://api.vagalume.com.br/search.excerpt?q=Skillet&limit=5", {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
            }
        });
        console.log("STATUS:", res.status);
        console.log((await res.text()).substring(0, 500));
    } catch(e) {
        console.log(e);
    }
}
run();
