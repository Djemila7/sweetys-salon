const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors()); // Autorise les requêtes cross-origin
app.use(express.json()); // Traitement des corps de requêtes JSON (AJAX)
app.use(express.urlencoded({ extended: true })); // Traitement des formulaires POST HTML

// =============================================================
// POOL DE CONNEXION MYSQL (WampServer)
// =============================================================
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'sweetys_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test de connexion initiale
db.getConnection((err, connection) => {
    if (err) {
        console.error('Erreur de connexion à MySQL :', err.message);
    } else {
        console.log('Connecté à la base de données sweetys_db !');
        connection.release();
    }
});

// =============================================================
// 1. ROUTES CLIENTES
// =============================================================

// GET /api/clientes - Récupérer toutes les clientes
app.get('/api/clientes', (req, res) => {
    const query = 'SELECT * FROM clientes ORDER BY id DESC';
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des clientes.', details: err.message });
        }
        res.json(results);
    });
});

// DELETE /api/clientes/:id - Supprimer une cliente
app.delete('/api/clientes/:id', (req, res) => {
    const clienteId = req.params.id;
    const query = 'DELETE FROM clientes WHERE id = ?';

    db.query(query, [clienteId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la suppression.', details: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cliente non trouvée.' });
        }
        res.json({
            message: `Cliente ID ${clienteId} et ses rendez-vous associés ont été supprimés avec succès.`
        });
    });
});

// =============================================================
// 2. ROUTES SERVICES & TARIFS
// =============================================================

// GET /api/services - Récupérer tous les services
app.get('/api/services', (req, res) => {
    const query = 'SELECT * FROM services ORDER BY id ASC';
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des services.', details: err.message });
        }
        res.json(results);
    });
});

// POST /api/services - Ajouter un nouveau service
app.post('/api/services', (req, res) => {
    const { libelle, prix, duree_minutes, duree } = req.body;
    const finalDuree = duree_minutes || duree;

    if (!libelle || prix === undefined || !finalDuree) {
        return res.status(400).json({ error: 'Le libellé, le prix et la durée sont obligatoires.' });
    }

    const query = 'INSERT INTO services (libelle, prix, duree_minutes) VALUES (?, ?, ?)';
    db.query(query, [libelle, prix, finalDuree], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de l\'ajout du service.', details: err.message });
        }
        res.status(201).json({
            message: 'Nouveau service créé avec succès !',
            id: result.insertId
        });
    });
});

// PUT /api/services/:id - Modifier un service
app.put('/api/services/:id', (req, res) => {
    const serviceId = req.params.id;
    const { libelle, prix, duree_minutes, duree } = req.body;
    const finalDuree = duree_minutes || duree;

    if (!libelle || prix === undefined || !finalDuree) {
        return res.status(400).json({ error: 'Tous les champs (libelle, prix, duree) sont obligatoires.' });
    }

    const query = 'UPDATE services SET libelle = ?, prix = ?, duree_minutes = ? WHERE id = ?';
    db.query(query, [libelle, prix, finalDuree, serviceId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la modification.', details: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Service non trouvé.' });
        }
        res.json({ message: 'Service mis à jour avec succès !' });
    });
});

// DELETE /api/services/:id - Supprimer un service
app.delete('/api/services/:id', (req, res) => {
    const serviceId = req.params.id;
    const query = 'DELETE FROM services WHERE id = ?';

    db.query(query, [serviceId], (err, result) => {
        if (err) {
            console.error("Erreur SQL lors de la suppression :", err);

            if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
                return res.status(400).json({ 
                    error: "Impossible de supprimer ce service car il est actuellement associé à un ou plusieurs rendez-vous." 
                });
            }

            return res.status(500).json({ error: 'Erreur lors de la suppression du service.', details: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Service introuvable." });
        }

        res.json({ message: "Service supprimé avec succès !" });
    });
});

// =============================================================
// 3. ROUTES RENDEZ-VOUS
// =============================================================

// GET /api/rendezvous - Récupérer le planning avec jointures SQL
app.get('/api/rendezvous', (req, res) => {
    const query = `
        SELECT 
            rv.id,
            rv.date_heure,
            rv.statut,
            c.nom AS cliente_nom,
            c.prenom AS cliente_prenom,
            c.telephone AS cliente_telephone,
            s.libelle AS service_libelle,
            s.prix AS service_prix
        FROM rendez_vous rv
        LEFT JOIN clientes c ON rv.cliente_id = c.id
        LEFT JOIN services s ON rv.service_id = s.id
        ORDER BY rv.date_heure DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des rendez-vous.', details: err.message });
        }
        res.json(results);
    });
});

// POST /api/rendezvous - Enregistrement via AJAX (JSON)
app.post('/api/rendezvous', (req, res) => {
    const { nom, prenom, telephone, email, service_id, employe_id, date_heure, date_rdv } = req.body;
    const finalDate = date_heure || date_rdv;

    // Validation des champs obligatoires (l'email est optionnel)
    if (!nom || !prenom || !telephone || !service_id || !finalDate) {
        return res.status(400).json({ error: 'Tous les champs obligatoires (nom, prénom, téléphone, service, date) doivent être remplis.' });
    }

    // 1. Enregistrement automatique de la cliente (gestion d'un email vide par null)
    const sqlCliente = 'INSERT INTO clientes (nom, prenom, telephone, email) VALUES (?, ?, ?, ?)';
    const finalEmail = email ? email.trim() : null;
    
    db.query(sqlCliente, [nom, prenom, telephone, finalEmail], (errCliente, resCliente) => {
        if (errCliente) {
            return res.status(500).json({ error: 'Erreur lors de l\'enregistrement de la cliente.', details: errCliente.message });
        }

        const cliente_id = resCliente.insertId;
        const finalEmployeId = employe_id || 1; // Si aucun employé choisi, utilise l'employé 1 par défaut

        // 2. Enregistrement du rendez-vous lié à cette cliente
        const sqlRDV = `
            INSERT INTO rendez_vous (cliente_id, employe_id, service_id, date_heure, statut) 
            VALUES (?, ?, ?, ?, 'planifie')
        `;

        db.query(sqlRDV, [cliente_id, finalEmployeId, service_id, finalDate], (errRDV, resRDV) => {
            if (errRDV) {
                return res.status(500).json({ error: 'Erreur lors de la création du rendez-vous.', details: errRDV.message });
            }

            res.status(201).json({
                message: 'Rendez-vous créé avec succès !',
                rendez_vous_id: resRDV.insertId
            });
        });
    });
});

// POST /api/rendezvous-native - Enregistrement via Formulaire HTML Natif
app.post('/api/rendezvous-native', (req, res) => {
    const { nom, prenom, telephone, email, service_id, date_rdv, employe_id } = req.body;

    if (!nom || !prenom || !telephone || !service_id || !date_rdv) {
        return res.status(400).send('Veuillez remplir tous les champs obligatoires du formulaire.');
    }

    const sqlCliente = 'INSERT INTO clientes (nom, prenom, telephone, email) VALUES (?, ?, ?, ?)';
    const finalEmail = email ? email.trim() : null;
    
    db.query(sqlCliente, [nom, prenom, telephone, finalEmail], (errCliente, resCliente) => {
        if (errCliente) {
            console.error('Erreur lors de la création de la cliente :', errCliente);
            return res.status(500).send('Erreur serveur lors de l\'enregistrement de vos coordonnées.');
        }

        const cliente_id = resCliente.insertId; 
        const finalEmployeId = employe_id || 1; 

        const sqlRDV = `
            INSERT INTO rendez_vous (cliente_id, employe_id, service_id, date_heure, statut) 
            VALUES (?, ?, ?, ?, 'planifie')
        `;

        db.query(sqlRDV, [cliente_id, finalEmployeId, service_id, date_rdv], (errRDV, resRDV) => {
            if (errRDV) {
                console.error('Erreur lors de la création du rendez-vous :', errRDV);
                return res.status(500).send('Erreur serveur lors de la réservation du rendez-vous.');
            }

            res.send(`
                <!DOCTYPE html>
                <html lang="fr">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Confirmation Réservation</title>
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            background-color: #f8fafc;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                        }
                        .card {
                            background: white;
                            padding: 40px;
                            border-radius: 12px;
                            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                            text-align: center;
                            max-width: 450px;
                            border-top: 5px solid #2a9df4;
                        }
                        h1 { color: #1c7ed6; font-size: 1.5rem; margin-bottom: 10px; }
                        p { color: #495057; font-size: 1rem; line-height: 1.5; }
                        .info-box {
                            background-color: #e7f5ff;
                            border-radius: 8px;
                            padding: 12px;
                            margin: 15px 0;
                            color: #1971c2;
                            font-weight: 500;
                        }
                        .btn-back {
                            display: inline-block;
                            margin-top: 20px;
                            padding: 10px 20px;
                            background-color: #2a9df4;
                            color: white;
                            text-decoration: none;
                            border-radius: 6px;
                            font-weight: 600;
                            transition: background 0.2s;
                        }
                        .btn-back:hover { background-color: #1c7ed6; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>Réservation Confirmée !</h1>
                        <p>Merci <strong>${prenom} ${nom}</strong>, votre rendez-vous a bien été enregistré dans notre base de données.</p>
                        <div class="info-box">
                            Rendez-vous N° <strong>#${resRDV.insertId}</strong>
                        </div>
                        <a href="javascript:history.back()" class="btn-back">Retour au site</a>
                    </div>
                </body>
                </html>
            `);
        });
    });
});

// =============================================================
// 4. ROUTES EMPLOYÉS
// =============================================================

// GET /api/employes - Récupérer tous les employés
app.get('/api/employes', (req, res) => {
    const query = 'SELECT * FROM employes ORDER BY id DESC';
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des employés.', details: err.message });
        }
        res.json(results);
    });
});

// POST /api/employes - Ajouter un nouvel employé
app.post('/api/employes', (req, res) => {
    const { nom, prenom, telephone, specialite } = req.body;

    if (!nom || !prenom) {
        return res.status(400).json({ error: 'Le nom et le prénom sont obligatoires.' });
    }

    const query = 'INSERT INTO employes (nom, prenom, telephone, specialite) VALUES (?, ?, ?, ?)';
    db.query(query, [nom, prenom, telephone || null, specialite || null], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de l\'ajout de l\'employé.', details: err.message });
        }
        res.status(201).json({
            message: 'Employé(e) créé(e) avec succès !',
            id: result.insertId
        });
    });
});

// DELETE /api/employes/:id - Supprimer un employé
app.delete('/api/employes/:id', (req, res) => {
    const employeId = req.params.id;
    const query = 'DELETE FROM employes WHERE id = ?';

    db.query(query, [employeId], (err, result) => {
        if (err) {
            console.error("Erreur SQL lors de la suppression de l'employé :", err);

            if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
                return res.status(400).json({ 
                    error: "Impossible de supprimer cet(te) employé(e) car il/elle est rattaché(e) à des rendez-vous." 
                });
            }

            return res.status(500).json({ error: 'Erreur lors de la suppression de l\'employé.', details: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Employé(e) non trouvé(e).' });
        }

        res.json({ message: 'Employé(e) supprimé(e) avec succès !' });
    });
});

// =============================================================
// DÉMARRAGE DU SERVEUR
// =============================================================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Serveur API Node.js démarré sur http://localhost:${PORT}`);
});