from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector

app = Flask(__name__)
# Activation de CORS pour permettre à admin.html (port 3000 / file://) de contacter Flask (port 5000)
CORS(app)

def get_db_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="sweetys_db"
    )

# 1. LIRE LES RENDEZ-VOUS (GET avec LEFT JOIN sécurisé)
@app.route('/rendez-vous', methods=['GET'])
def get_rendez_vous():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = """
            SELECT 
                rv.id AS rdv_id,
                rv.date_heure,
                rv.statut,
                IFNULL(c.nom, 'Client inconnu') AS cliente_nom,
                IFNULL(c.prenom, '') AS cliente_prenom,
                c.telephone AS cliente_telephone,
                IFNULL(s.libelle, 'Service inconnu') AS service_nom,
                IFNULL(s.prix, 0) AS service_prix
            FROM rendez_vous rv
            LEFT JOIN clientes c ON rv.cliente_id = c.id
            LEFT JOIN services s ON rv.service_id = s.id
            ORDER BY rv.date_heure DESC
        """
        cursor.execute(query)
        resultats = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({"total": len(resultats), "data": resultats}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 2. MODIFIER UN RENDEZ-VOUS (PUT)
@app.route('/rendez-vous', methods=['PUT'])
def update_rendez_vous():
    data = request.get_json()
    if not data or 'id' not in data or 'statut' not in data or 'date_heure' not in data:
        return jsonify({"error": "Les champs id, statut et date_heure sont requis"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = "UPDATE rendez_vous SET statut = %s, date_heure = %s WHERE id = %s"
        cursor.execute(query, (data['statut'], data['date_heure'], data['id']))
        conn.commit()
        updated_rows = cursor.rowcount
        cursor.close()
        conn.close()

        if updated_rows > 0:
            return jsonify({"message": f"Rendez-vous n°{data['id']} mis à jour avec succès !"}), 200
        else:
            return jsonify({"error": "Aucun rendez-vous trouvé avec cet ID."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)