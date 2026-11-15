-- Date de fin de validité d'une pièce (passeport, certificat de police, test de langue…).
alter table document add column expires date;
