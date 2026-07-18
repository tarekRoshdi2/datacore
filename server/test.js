import axios from 'axios';

const urls = [
    'http://www.houtskoolgroothandel.nl/',
    'https://www.barbecueshop.nl/',
    'https://www.echtgoed.nl/',
    'http://bbqflavour.com/',
    'https://www.houtskoolhandel.nl/'
];

async function test() {
    for (const url of urls) {
        console.log(`Testing ${url}...`);
        try {
            const res = await axios.post('http://localhost:3000/api/scrape/web', {
                url,
                prompt: 'بريد التواصل'
            });
            const emailField = res.data.data.find(d => d.field === 'البريد الإلكتروني');
            console.log(`  -> Email: ${emailField ? emailField.value : 'Not found'}`);
        } catch (err) {
            console.log(`  -> Error: ${err.message}`);
        }
    }
}
test();
