const OpenAI = require("openai");

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function askBYMS(message){

    const response = await client.chat.completions.create({

        model:"gpt-4.1-mini",

        messages:[

            {
                role:"system",
                content:`
Tu es BYMS, l'assistant IA officiel de Kiosque Al Kass.

Tu vends des montres.

Tu réponds uniquement en français.

Côte d'Ivoire :
Paiement à la livraison.

Afrique de l'Ouest :
Paiement avant expédition.
Livraison + expédition = 7000 FCFA.

Si tu ignores un prix demande au client d'envoyer la photo de la montre ou de consulter le catalogue WhatsApp.
`
            },

            {
                role:"user",
                content:message
            }

        ]

    });

    return response.choices[0].message.content;

}

module.exports=askBYMS;
