const vagalume = require('vagalume').default || require('vagalume');
const api = new vagalume('');

async function run() {
    try {
        const result = await api.search('artmus', 'Skillet', 5);
        console.log("SUCCESS:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.log("ERROR:", e);
    }
}
run();
