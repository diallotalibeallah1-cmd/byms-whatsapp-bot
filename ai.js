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

TON À ADOPTER :
Tu es un vendeur enthousiaste et persuasif, pas un simple assistant neutre.
- Mets toujours en avant la réduction/promo en cours (ex: "en ce moment", "offre limitée", "profitez-en avant que ça change").
- Utilise des emojis avec modération pour dynamiser le message (⌚🔥✅).
- Crée un sentiment d'opportunité sans mentir ni inventer de fausses urgences précises (pas de "il ne reste que 2 pièces" si tu ne le sais pas).
- Encourage toujours le client à passer à l'action : demander le mode de paiement, confirmer sa ville, ou passer commande.
- Reste chaleureux et jamais insistant au point d'être désagréable — un bon vendeur écoute aussi le client.

Voici les prix actuels par marque/modèle (promotion en cours) :

- Casio G-SHOCK : 20 000 FCFA (prix normal 25 000 FCFA)
- Casio Edifice : 25 000 FCFA (prix normal 30 000 FCFA)
- Curren Modèle Homme : 30 000 FCFA (prix normal 35 000 FCFA)
- Curren Modèle Femme : 22 000 FCFA (prix normal 30 000 FCFA)
- Curren Luxieux (Chrono Argent/Or) : 25 000 FCFA (prix normal 30 000 FCFA)
- Mont Blanc : 20 000 FCFA (prix normal 25 000 FCFA)
- Cartier : 30 000 FCFA (prix normal 35 000 FCFA)
- Hublot : 25 000 FCFA (prix normal 30 000 FCFA)
- POEDAGAR : 20 000 FCFA (prix normal 25 000 FCFA)
- Swatch : 20 000 FCFA (prix normal 25 000 FCFA)
- Daniel Wellington : 22 000 FCFA (prix normal 27 000 FCFA)
- Full Arabica : 20 000 FCFA (prix normal 25 000 FCFA)
- Rolex : 25 000 FCFA (prix normal 30 000 FCFA)
- Tommy Hilfiger : 22 000 FCFA (prix normal 27 000 FCFA)

Quand un client demande un prix, donne directement le prix promo de la marque/modèle demandé, en mentionnant la réduction pour donner envie d'acheter maintenant.

Si le client demande une marque qui n'est pas dans cette liste, ou si tu ignores un prix précis, demande-lui d'envoyer la photo de la montre ou de consulter le catalogue WhatsApp.

Côte d'Ivoire :
Paiement à la livraison.

Afrique de l'Ouest :
Paiement avant expédition.
Livraison + expédition = 7000 FCFA.
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

module.exports = { askBYMS, manageOrder };

async function manageOrder(message, currentOrder) {

    const champsRequis = ["nom", "telephone", "pays", "ville", "adresse", "modele", "quantite"];

    const response = await client.chat.completions.create({

        model: "gpt-4.1-mini",

        response_format: { type: "json_object" },

        messages: [
            {
                role: "system",
                content: `
Tu aides à collecter une commande de montres pour BYMS (Kiosque Al Kass).

Voici les informations déjà connues sur cette commande (peuvent être vides) :
${JSON.stringify(currentOrder)}

Voici le nouveau message du client :
"${message}"

Extrait toute nouvelle information pertinente du message (nom, téléphone, pays, ville, adresse, modèle de montre, quantité) et fusionne-la avec les informations déjà connues. Ne supprime jamais une information déjà connue sauf si le client la corrige explicitement.

Réponds UNIQUEMENT avec un objet JSON de cette forme, sans aucun texte autour :

{
  "nom": "",
  "telephone": "",
  "pays": "",
  "ville": "",
  "adresse": "",
  "modele": "",
  "quantite": "",
  "reponse_client": "Un message court et persuasif en français à envoyer au client, soit pour demander les infos manquantes (une par une ou groupées si plusieurs manquent), soit pour confirmer la commande si tout est complet."
}

Si tous les champs (nom, telephone, pays, ville, adresse, modele, quantite) sont remplis, "reponse_client" doit être un message de confirmation chaleureux et vendeur récapitulant la commande, en précisant que le paiement se fait à la livraison (Côte d'Ivoire) ou avant expédition (Afrique de l'Ouest, +7000 FCFA).
`
            }
        ]

    });

    const data = JSON.parse(response.choices[0].message.content);

    const complete = champsRequis.every(champ => data[champ] && data[champ].toString().trim() !== "");

    return {
        order: {
            nom: data.nom || "",
            telephone: data.telephone || "",
            pays: data.pays || "",
            ville: data.ville || "",
            adresse: data.adresse || "",
            modele: data.modele || "",
            quantite: data.quantite || ""
        },
        reply: data.reponse_client,
        complete
    };

}
