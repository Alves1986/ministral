const run = async () => {
    try {
        const res = await fetch("https://api.vagalume.com.br/search.excerpt?q=Skillet&limit=5", {
            headers: {
                "Accept-Encoding": "gzip, deflate, br",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
            }
        });
        console.log(res.status);
        console.log((await res.text()).substring(0, 500));
    } catch(e) {
        console.log(e);
    }
}
run();
