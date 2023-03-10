module.exports = function (RED) {
    function encryptValue(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.topic = config.topic;
        node.variable = config.variable;
        node.clientNodeId = config.client;

        node.client = RED.nodes.getNode(node.clientNodeId);
        node.publishTopic = `${node.topic}/${node.variable}`;

        if (node.client.connected) {
            node.status({
                fill: "green",
                shape: "dot",
                text: "node-red:common.status.connected",
            });
        }

        node.client.register(node);

        // seal
        const globalContext = this.context().global;
        const seal = globalContext.get("seal");
        if (!seal) return;

        const nodeContext = this.context();
        nodeContext.set("numberArray", Array(4096).fill(0));

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
                const contextNode = RED.nodes.getNode(config.context);
                const publicKeyNode = RED.nodes.getNode(config.publicKey);

                numberArray.unshift(parseFloat(msg.payload));
                numberArray = numberArray.slice(0, -1);
                nodeContext.set("numberArray", numberArray);
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

                        // create array that all index equal value for html and encoder.slotCount(polyModulus / 2) long;
                        const array = Float64Array.from(numberArray);
                        const plainText = encoder.encode(array, scale);
                        const cipherText = encryptor.encrypt(plainText);

                        node.status({
                            fill: "yellow",
                            shape: "ring",
                            text: `Encrypted`,
                        });

                        // delete unuse instance of seal objects prevent out of wasm memory error

                        // latestNodeId use for check if ciphertext value change, add(E) and multi(E) node using this object property
                        msg.latestNodeId = config.id;
                        // pass input node type for checking from node that connected to this node
                        msg.payload = cipherText.save();
                        // if not error show chainIndex of output ciphertext

                        cipherText.delete();
                        plainText.delete();
                        publicKey.delete();
                        encryptor.delete();

                        node.client.writeCStore(node.publishTopic, msg.payload);
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

        node.on("close", function (removed, done) {
            if (node.client) {
                node.client.deregister(node, done, removed);
                node.client = null;
            } else {
                done();
            }
        });
    }

    RED.nodes.registerType("encrypt value", encryptValue);
};
