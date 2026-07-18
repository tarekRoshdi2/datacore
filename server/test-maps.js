import axios from 'axios';

async function testMaps() {
    try {
        const response = await axios.post('http://localhost:3000/api/scrape/maps', {
            query: 'Houtskool Groothandel',
            location: 'Netherlands',
            mapReviews: true,
            mapPhones: true,
            mapWebsites: true,
            mapAddress: true
        });
        
        console.log('Success:', response.data.success);
        console.log('Results Count:', response.data.data.length);
        console.log(JSON.stringify(response.data.data, null, 2));
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testMaps();
