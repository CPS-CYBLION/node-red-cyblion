module.exports = function (RED) {
    function encryptValue(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.topic = config.topic;
        node.variable = config.variable;
        node.clientNodeId = config.client;

        node.client = RED.nodes.getNode(node.clientNodeId);
        node.publishTopic = `${node.topic}/${node.variable}`;

        // seal
        const globalContext = this.context().global;
        const seal = globalContext.get("seal");
        if (!seal) return;

        const nodeContext = this.context();
        nodeContext.set("numberArray", Array(4096).fill(0));
        nodeContext.set("timeArray", Array(4096).fill(0));

        try {
            if (!config.context) {
                throw new Error(`didn't select context`);
            } else if (!config.publicKey) {
                throw new Error(`didn't select publickey`);
            } else {
                node.status({});
            }
        } catch (err) {
            node.error(err);
            node.status({ fill: "red", shape: "ring", text: err });
        }

        if (node.client) {
            node.on("input", function (msg) {
                let numberArray = nodeContext.get("numberArray");
                let timeArray = nodeContext.get("timeArray");
                const contextNode = RED.nodes.getNode(config.context);
                const publicKeyNode = RED.nodes.getNode(config.publicKey);

                numberArray.unshift(parseFloat(msg.payload));
                numberArray = numberArray.slice(0, -1);
                nodeContext.set("numberArray", numberArray);

                timeArray.unshift(Date.now());
                timeArray = timeArray.slice(0, -1);
                nodeContext.set("timeArray", timeArray);
                try {
                    if (!contextNode) {
                        throw new Error(`SEAL Context Node not found`);
                    } else if (!publicKeyNode) {
                        throw new Error(`PublicKey node not found`);
                    } else {
                        //get seal objects needed to encrypt the value from the config node
                        const context = contextNode.context;
                        const scale = contextNode.scale;
                        const publicKey = seal.PublicKey();
                        publicKey.load(context, publicKeyNode.publicKeyBase64);
                        const encoder = contextNode.encoder;
                        const encryptor = seal.Encryptor(context, publicKey);

                        const array = Float64Array.from(numberArray);
                        const plainText = encoder.encode(array, scale);
                        const cipherText = encryptor.encrypt(plainText);

                        const timeFloat64Array = Float64Array.from(timeArray);
                        const plainText_time = encoder.encode(
                            timeFloat64Array,
                            scale
                        );
                        const cipherText_time =
                            encryptor.encrypt(plainText_time);

                        node.status({
                            fill: "yellow",
                            shape: "ring",
                            text: `Encrypted`,
                        });

                        msg.latestNodeId = config.id;
                        const cipherText_base64 = cipherText.save();
                        const cipherText_base64_time = cipherText_time.save();

                        plainText_time.delete();
                        cipherText_time.delete();
                        cipherText.delete();
                        plainText.delete();
                        publicKey.delete();
                        encryptor.delete();

                        node.client.writeCStore(
                            node.publishTopic,
                            cipherText_base64
                        );
                        node.client.writeCStore(
                            `${node.topic}/time`,
                            cipherText_base64_time
                        );

                        node.status({
                            fill: "green",
                            shape: "ring",
                            text: `Sent`,
                        });
                    }
                } catch (err) {
                    node.error(err);
                    node.status({ fill: "red", shape: "ring", text: err });
                }
            });
        }
    }

    RED.nodes.registerType("encrypt timeseries", encryptValue);
};
