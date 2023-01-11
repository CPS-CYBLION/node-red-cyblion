const Cyblion = require('../index.js');

let cyblion = new Cyblion({
	deviceid: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
	devicetoken: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
	subscribe_shadow_updated: true,
	secure: false
});

cyblion.on('connected', () => {
	let timer = 0, count = 0;;
	console.log('connected..')

	cyblion.subscribe('@msg/#');
	cyblion.subscribe('@cmsg/#');
	cyblion.subscribe('@cstore/data/updated/#');

	count = 0;
	if (!timer) {
		timer = setInterval(()=>{
			console.log('-'.repeat(60));
			count++;

			cyblion.publish('@cmsg/ping', count);

			cyblion.publish('@msg/ping', 2*count);

			cyblion.writeShadow('x', count);
			cyblion.writeShadow({
				temp: count,
				humid: 2*count
			});

			cyblion.writeCStore('home/bedroom/temp', String(count));
		},3000);
	}
});

cyblion.on('disconnected', () => {
	console.log('disconnected..')
	if (timer) {
		clearInterval(timer);
		timer = 0;
	}
});


cyblion.on('shadow_updated', (data) => {
	console.log('shadow_updated --> ', data)
});

cyblion.on('msg', (topic, payload) => {
	console.log('incoming netpie msg --> ',{topic, payload});
});

cyblion.on('cmsg', (topic, payload) => {
	console.log('incoming cyblion msg --> ',{topic, payload});
});

cyblion.on('cstore_updated', (key, value) => {
	console.log('cstore_updated --> ',{key, value});
});

cyblion.connect();
