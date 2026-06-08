const vagalume = require('vagalume');
const api = new vagalume('');
api.search('artmus', 'Skillet', 5).then((res) => {
    console.log(JSON.stringify(res, null, 2));
}).catch(console.error);
