<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");

$host = "localhost";
$db_name = "sweetys_db";
$username = "root";
$password = "";

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db_name;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(array("error" => "Erreur de connexion : " . $e->getMessage()));
    exit();
}

// Statistique 1 : Chiffre d'affaires et nombre de rendez-vous par service
$sql_stat1 = "SELECT 
                s.libelle AS service,
                COUNT(rv.id) AS total_rendez_vous,
                COALESCE(SUM(s.prix), 0) AS chiffre_affaires
              FROM services s
              LEFT JOIN rendez_vous rv ON s.id = rv.service_id
              GROUP BY s.id, s.libelle";

$stmt1 = $pdo->prepare($sql_stat1);
$stmt1->execute();
$stat_services = $stmt1->fetchAll(PDO::FETCH_ASSOC);

// Statistique 2 : Répartition des rendez-vous par statut
$sql_stat2 = "SELECT 
                statut,
                COUNT(id) AS nombre
              FROM rendez_vous
              GROUP BY statut";

$stmt2 = $pdo->prepare($sql_stat2);
$stmt2->execute();
$stat_statuts = $stmt2->fetchAll(PDO::FETCH_ASSOC);

// Réponse JSON
echo json_encode(array(
    "statistique_services" => $stat_services,
    "statistique_statuts" => $stat_statuts
));
?>