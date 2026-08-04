const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Helper pour échapper les caractères spéciaux en XML
function escapeXml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

async function exportToXml() {
    let connection;
    try {
        // 1. Connexion à la base MySQL
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'sweetys_db'
        });

        console.log("Connecté à la base de données sweetys_db...");

        // 2. Récupération des clientes et des services
        const [clientes] = await connection.execute('SELECT * FROM clientes');
        const [services] = await connection.execute('SELECT * FROM services');

        // 3. Construction de l'arborescence XML
        let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmlContent += '<sweetys_db_export>\n';

        // --- HIERARCHIE : CLIENTES -> RENDEZ_VOUS (Parent -> Enfant) ---
        xmlContent += '  <clientes>\n';
        for (const cliente of clientes) {
            xmlContent += `    <cliente id="${cliente.id}">\n`;
            xmlContent += `      <nom>${escapeXml(cliente.nom)}</nom>\n`;
            xmlContent += `      <prenom>${escapeXml(cliente.prenom)}</prenom>\n`;
            xmlContent += `      <telephone>${escapeXml(cliente.telephone)}</telephone>\n`;
            xmlContent += `      <email>${escapeXml(cliente.email)}</email>\n`;

            // Récupérer les RDV liés à cette cliente (avec date_heure corrigé)
            const [rdvs] = await connection.execute(
                `SELECT rv.id, rv.date_heure, rv.statut, s.libelle AS service_nom, s.prix 
                 FROM rendez_vous rv 
                 LEFT JOIN services s ON rv.service_id = s.id 
                 WHERE rv.cliente_id = ?`,
                [cliente.id]
            );

            xmlContent += '      <rendez_vous_liste>\n';
            for (const rdv of rdvs) {
                xmlContent += `        <rendez_vous id="${rdv.id}">\n`;
                xmlContent += `          <service>${escapeXml(rdv.service_nom)}</service>\n`;
                xmlContent += `          <prix>${rdv.prix || 0}</prix>\n`;
                xmlContent += `          <date_heure>${rdv.date_heure}</date_heure>\n`;
                xmlContent += `          <statut>${escapeXml(rdv.statut)}</statut>\n`;
                xmlContent += '        </rendez_vous>\n';
            }
            xmlContent += '      </rendez_vous_liste>\n';
            xmlContent += '    </cliente>\n';
        }
        xmlContent += '  </clientes>\n';

        // --- SECTION : SERVICES ---
        xmlContent += '  <services>\n';
        for (const service of services) {
            xmlContent += `    <service id="${service.id}">\n`;
            xmlContent += `      <libelle>${escapeXml(service.libelle)}</libelle>\n`;
            xmlContent += `      <prix>${service.prix}</prix>\n`;
            xmlContent += '    </service>\n';
        }
        xmlContent += '  </services>\n';

        xmlContent += '</sweetys_db_export>';

        // 4. Écriture dans le fichier export.xml
        const outputPath = path.join(__dirname, 'export.xml');
        fs.writeFileSync(outputPath, xmlContent, 'utf8');

        console.log(`✅ Fichier XML généré avec succès : ${outputPath}`);

    } catch (error) {
        console.error("❌ Erreur lors de la génération du XML :", error.message);
    } finally {
        if (connection) await connection.end();
    }
}

exportToXml();