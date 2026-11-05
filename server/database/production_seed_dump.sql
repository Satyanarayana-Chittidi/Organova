-- ====================================================================
-- ORGAN DONATION PLATFORM: DATABASE INITIALIZATION SCRIPT
-- ====================================================================

CREATE DATABASE IF NOT EXISTS organ_donation_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE organ_donation_db;

-- --------------------------------------------------------------------
-- 1. USERS (Authentication & Role Gateway)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    role ENUM('USER', 'HOSPITAL', 'ADMIN') NOT NULL,
    auth_provider ENUM('LOCAL', 'GOOGLE') NOT NULL DEFAULT 'LOCAL',
    google_id VARCHAR(255) NULL UNIQUE,
    avatar_url VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 2. CITIZEN PROFILES (Individual Donors & Recipients)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS citizen_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender ENUM('MALE', 'FEMALE', 'OTHER') NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    emergency_contact_name VARCHAR(100) NOT NULL,
    emergency_contact_phone VARCHAR(20) NOT NULL,
    address_line VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    avatar_url VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 3. MEDICAL HUBS (Accredited Hospitals & Medical Centers)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medical_hubs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL UNIQUE,
    hub_type ENUM('HOSPITAL') NOT NULL DEFAULT 'HOSPITAL',
    name VARCHAR(150) NOT NULL,
    license_number VARCHAR(100) NOT NULL UNIQUE,
    contact_phone VARCHAR(20) NOT NULL,
    address_line VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    verification_status ENUM('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING_APPROVAL',
    verified_by_admin_id VARCHAR(36) NULL,
    verified_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by_admin_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_hubs_status (verification_status),
    INDEX idx_hubs_geo (latitude, longitude)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 4. ORGAN TYPES (Static Medical Rules & Shelf-Life Hours)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organ_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code ENUM('HEART', 'KIDNEY', 'LIVER', 'LUNG', 'PANCREAS', 'CORNEA', 'BONE_MARROW', 'BLOOD') NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    category ENUM('SOLID_ORGAN', 'TISSUE', 'CELL_FLUID') NOT NULL,
    max_viability_hours INT NOT NULL,
    allow_living_donor BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB;

-- Pre-seed the 8 verified medical donation types
INSERT INTO organ_types (code, name, category, max_viability_hours, allow_living_donor)
VALUES
    ('HEART', 'Heart', 'SOLID_ORGAN', 6, FALSE),
    ('LUNG', 'Lungs', 'SOLID_ORGAN', 6, FALSE),
    ('LIVER', 'Liver', 'SOLID_ORGAN', 12, TRUE),
    ('KIDNEY', 'Kidneys', 'SOLID_ORGAN', 36, TRUE),
    ('PANCREAS', 'Pancreas', 'SOLID_ORGAN', 18, FALSE),
    ('CORNEA', 'Eyes (Cornea)', 'TISSUE', 336, FALSE),
    ('BONE_MARROW', 'Bone Marrow', 'CELL_FLUID', 72, TRUE),
    ('BLOOD', 'Blood', 'CELL_FLUID', 1008, TRUE)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- --------------------------------------------------------------------
-- 5. DONOR PLEDGES (Advance Legal Directives by Citizens)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS donor_pledges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    organ_type_id INT NOT NULL,
    consent_type ENUM('DECEASED_ONLY', 'LIVING_ALLOWED') NOT NULL,
    pledge_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status ENUM('ACTIVE', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organ_type_id) REFERENCES organ_types(id) ON DELETE RESTRICT,
    UNIQUE KEY uk_user_organ_consent (user_id, organ_type_id, consent_type)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 6. AVAILABLE ORGANS (Harvested Assets with Viability Countdown)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS available_organs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organ_type_id INT NOT NULL,
    donor_user_id VARCHAR(36) NULL,
    harvesting_hub_id INT NOT NULL,
    current_hub_id INT NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    harvested_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    status ENUM('AVAILABLE', 'MATCHING', 'ALLOCATED', 'IN_TRANSIT', 'DELIVERED', 'TRANSPLANTED', 'EXPIRED') NOT NULL DEFAULT 'AVAILABLE',
    clinical_notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organ_type_id) REFERENCES organ_types(id) ON DELETE RESTRICT,
    FOREIGN KEY (donor_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (harvesting_hub_id) REFERENCES medical_hubs(id) ON DELETE RESTRICT,
    FOREIGN KEY (current_hub_id) REFERENCES medical_hubs(id) ON DELETE RESTRICT,
    INDEX idx_organs_available (organ_type_id, status, expires_at)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 7. TRANSPLANT REQUESTS (Prioritized Patient Waiting List)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transplant_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipient_user_id VARCHAR(36) NOT NULL,
    attending_hub_id INT NOT NULL,
    organ_type_id INT NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    urgency_tier ENUM('TIER_1_EMERGENCY', 'TIER_2_URGENT', 'TIER_3_ROUTINE') NOT NULL,
    medical_summary TEXT NOT NULL,
    status ENUM('PENDING_VERIFICATION', 'WAITING_LIST', 'MATCH_OFFERED', 'ACCEPTED', 'SURGERY_SCHEDULED', 'FULFILLED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_VERIFICATION',
    verified_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (attending_hub_id) REFERENCES medical_hubs(id) ON DELETE RESTRICT,
    FOREIGN KEY (organ_type_id) REFERENCES organ_types(id) ON DELETE RESTRICT,
    INDEX idx_requests_queue (organ_type_id, status, urgency_tier, created_at)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 8. MATCHES (1:1 Allocation Pairs & Audit Trail)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organ_id INT NOT NULL,
    request_id INT NOT NULL,
    match_score DECIMAL(5, 2) NOT NULL,
    status ENUM('PROPOSED', 'ACCEPTED', 'DECLINED', 'COMPLETED') NOT NULL DEFAULT 'PROPOSED',
    offered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    response_deadline DATETIME NOT NULL,
    responded_at DATETIME NULL,
    FOREIGN KEY (organ_id) REFERENCES available_organs(id) ON DELETE RESTRICT,
    FOREIGN KEY (request_id) REFERENCES transplant_requests(id) ON DELETE RESTRICT,
    INDEX idx_matches_deadline (status, response_deadline)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 9. BLOOD INVENTORY (Bulk Commodity Stock Ledger)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blood_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hub_id INT NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    component ENUM('WHOLE_BLOOD', 'PACKED_RBC', 'PLATELETS', 'PLASMA') NOT NULL,
    units_available INT NOT NULL DEFAULT 0,
    last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hub_id) REFERENCES medical_hubs(id) ON DELETE CASCADE,
    UNIQUE KEY uk_hub_blood_component (hub_id, blood_group, component)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 10. BLOOD REQUESTS (High-Throughput Inventory Orders)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blood_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requester_user_id VARCHAR(36) NOT NULL,
    destination_hub_id INT NOT NULL,
    target_hub_id INT NULL,
    fulfilling_hub_id INT NULL,
    donor_user_id VARCHAR(36) NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    component ENUM('WHOLE_BLOOD', 'PACKED_RBC', 'PLATELETS', 'PLASMA') NOT NULL,
    units_requested INT NOT NULL,
    urgency ENUM('CRITICAL', 'URGENT', 'ROUTINE') NOT NULL,
    status ENUM('REQUESTED', 'APPROVED', 'DONOR_COMMITTED', 'DISPATCHED', 'COMPLETED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'REQUESTED',
    delivery_address TEXT NULL,
    patient_relationship VARCHAR(50) NULL DEFAULT 'SELF',
    patient_name VARCHAR(150) NULL,
    hospital_bed_no VARCHAR(100) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fulfilled_at DATETIME NULL,
    FOREIGN KEY (requester_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (destination_hub_id) REFERENCES medical_hubs(id) ON DELETE RESTRICT,
    FOREIGN KEY (target_hub_id) REFERENCES medical_hubs(id) ON DELETE SET NULL,
    FOREIGN KEY (fulfilling_hub_id) REFERENCES medical_hubs(id) ON DELETE SET NULL,
    FOREIGN KEY (donor_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_blood_req_queue (blood_group, component, status, urgency, created_at)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 11. BLOOD DONATION CAMPS (Community Drives & Hospital Camps)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blood_donation_camps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organizer_hub_id INT NOT NULL,
    created_by_user_id VARCHAR(36) NOT NULL,
    camp_name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    venue_name VARCHAR(200) NOT NULL,
    address_line VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NULL,
    pincode VARCHAR(20) NULL,
    camp_date DATE NOT NULL,
    end_date DATE NULL,
    start_time VARCHAR(20) NOT NULL DEFAULT '09:00 AM',
    end_time VARCHAR(20) NOT NULL DEFAULT '05:00 PM',
    contact_phone VARCHAR(30) NULL,
    contact_email VARCHAR(100) NULL,
    target_units INT NULL DEFAULT 100,
    status ENUM('UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'UPCOMING',
    latitude DECIMAL(10, 8) NULL,
    longitude DECIMAL(11, 8) NULL,
    map_url TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organizer_hub_id) REFERENCES medical_hubs(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_camp_status_date (status, camp_date)
) ENGINE=InnoDB;


-- ====================================================================
-- COMPLETE DEPLOYMENT SEED DATA (MOCK HOSPITALS, ORGANS, BLOOD, CAMPS)
-- ====================================================================

-- --------------------------------------------------------------------
-- DATA FOR TABLE: users (73 rows)
-- --------------------------------------------------------------------
INSERT INTO `users` (`id`, `email`, `password_hash`, `role`, `auth_provider`, `google_id`, `is_active`, `is_verified`, `avatar_url`, `created_at`, `updated_at`) VALUES
  ('003740d6-8857-40b3-b3af-0fd43f125a4b', 'gaurav.bhatt@patient.organdonation.in', NULL, 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-28 08:43:38', '2026-10-28 17:22:29'),
  ('04406dfa-6c7d-4ec8-b5ff-b0ee45a51bf2', 'organ.desk@lilavatihospital.com', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('14126dfb-5d7f-4e49-a52d-4b5412c5ba41', 'chittidisatyanarayana2@gmail.com', '$2b$10$yv6hGpPG6Dvkpy8CBYWIJu7/.Vl.Q9Wmj1EX6M/06P9abnzs6ZMtW', 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-25 05:27:38', '2026-10-25 05:27:54'),
  ('19f4335b-a006-42c5-b0e8-1a14aea06014', 'transplant@kokilabenhospitals.com', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('1d1e9c71-22ce-4539-8d99-b95098a6667e', 'transplant.coord@tmc.gov.in', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('1d8e07d7-6420-49ed-a07e-d14db4dc9081', 'vikram.malhotra@patient.organdonation.in', NULL, 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-28 08:43:38', '2026-10-28 17:22:29'),
  ('207063e9-795a-400a-b359-d35368699540', 'harish.pillai@patient.organdonation.in', NULL, 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-28 08:43:38', '2026-10-28 17:22:29'),
  ('2132ce28-ce0c-44c4-9489-279d29b1da67', 'nims.transplant@nims.edu.in', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('25099de0-538e-4920-ad88-aa76c83aac75', 'meera.deshmukh@patient.organdonation.in', NULL, 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-28 08:43:38', '2026-10-28 17:22:29'),
  ('26de60b9-1d77-4666-86dc-09169c5abacd', 'transplant.services@cmcvellore.ac.in', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('2e969834-dbfa-42c8-b83a-763d27ed758c', 'sunita.roy@patient.organdonation.in', NULL, 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-28 08:43:38', '2026-10-28 17:22:29'),
  ('2f58b970-401f-4573-ac2a-8b3c00b7c7dd', 'transplant@narayanahealth.org', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('32d3e06c-4d0d-4390-919a-ea596bac1aab', '2@g', '$2b$10$JJrbw2pqSYcrLkF0F3uYBuSyw5UIMjroTWmbqsf1aReIbijMR9ciG', 'USER', 'LOCAL', NULL, 1, 1, '/uploads/avatars/avatar-32d3e06c-4d0d-4390-919a-ea596bac1aab-1792911729163.jpg', '2026-10-25 05:50:06', '2026-10-25 07:02:09'),
  ('36ab4c5f-38d6-43af-a278-057ed4f931e2', 'transplant.coord@manipalhospitals.com', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('3f079d05-fcc8-411a-ba6e-9004526a2f21', 'rahul.verma@gmail.com', '$2b$10$wDsb7SwlpuzBBtDdvUf56u.8YuJBGt1.uwv7aSfCEuU1m.iY14GVC', 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:17:23', '2026-11-05 17:17:23'),
  ('4228dbae-b4b7-4eb4-a494-7c75b2ccf52e', 'organ.transplant@aims.amrita.edu', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('442ec46a-0f73-40b9-8966-88d118e8ae7a', 'p1@citizen.org', '$2b$10$wDsb7SwlpuzBBtDdvUf56u.8YuJBGt1.uwv7aSfCEuU1m.iY14GVC', 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-25 06:56:03', '2026-10-25 06:56:03'),
  ('44e8f9f0-bd62-49aa-a8b2-9a6f67429fc0', 'transplant.desk@medicahospitals.in', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('4674df15-aa24-44ca-90e1-951f22c3a115', 'ananya.iyer@patient.organdonation.in', NULL, 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-28 08:43:38', '2026-10-28 17:22:29'),
  ('49f624a2-a48a-443a-b926-18412ff77e46', '1@gmail.com', '$2b$10$.J2m/Dj.ZzhVHEGADXSw0.9ObWePucEM3GJHmfSShE.0bcXGHf5di', 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-25 05:39:56', '2026-10-25 05:40:12'),
  ('4b09173c-0b33-4f08-a21f-49a7e5f86192', 'no_pledge_test_1792947078669@example.com', '$2b$10$c38r5bkGDIIszvp7Xs9yPe2bbtkWRF6eUVnRZeCfiY5xKHbr1TA0G', 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-25 16:51:18', '2026-10-25 16:51:18'),
  ('4cb889ce-5e5f-4548-a9ec-03431ff2d0bf', 'transplant.saket@maxhealthcare.com', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('4e2e028b-2909-4e2a-8049-7ea5e0cdafdb', 'transplant.cmi@asterhospital.com', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('53a41ccb-aea7-407a-8f83-0a38e8d70885', 'kavita.reddy@patient.organdonation.in', NULL, 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-28 08:43:38', '2026-10-28 17:22:29'),
  ('56305174-4bd5-4ffe-838a-ff64d26d31e1', 'kavita.reddy@outlook.com', '$2b$10$wDsb7SwlpuzBBtDdvUf56u.8YuJBGt1.uwv7aSfCEuU1m.iY14GVC', 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:17:23', '2026-11-05 17:17:23'),
  ('56c4338a-a957-4b0c-9255-4d51276862ed', 'phantomcapacitor@gmail.com', '$2b$10$wDsb7SwlpuzBBtDdvUf56u.8YuJBGt1.uwv7aSfCEuU1m.iY14GVC', 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-24 11:18:23', '2026-10-24 11:18:50'),
  ('598ff7e2-9b50-4fc3-949a-e4d2d76cc66d', 'bhaaaaai@gmail.com', '$2b$10$roZUF5931uAuxO3hgWjEO.zidX3HCEyOCBfAlF4CY4EmRkt5LbB3S', 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-26 14:05:46', '2026-10-26 14:05:46'),
  ('5bf3c5d0-6259-4c65-b36c-c4a3bf2afbcf', 'amitabh.sen@patient.organdonation.in', NULL, 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-28 08:43:38', '2026-10-28 17:22:29'),
  ('5c43676b-babf-47fd-94eb-f09e795ff14f', 'transplant@pgimer.edu.in', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('5ff051d2-7a55-490e-9997-b370be9bdd0b', 'ruby.pune@hospital.org', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-10-25 06:56:03', '2026-10-25 06:56:03'),
  ('7645ee5b-8add-4ec7-b87b-2cc77d0d8ee5', 'pledge_revamp_1792946785364@example.com', '$2b$10$IK7BioxqJWSNyjrFNiG4j.j5EBZY/ABZ17aq2PjM9Ue/Zpo8UXINO', 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-25 16:46:25', '2026-10-25 16:46:25'),
  ('810c59cf-da16-495c-afdb-c6e154d6777c', '3@g', '$2b$10$/l1ADvX8h7wUgqskevKwq.K/KSRPDWt3WJhhigYv9sHycFI4eYxYS', 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-25 08:40:42', '2026-10-25 08:41:44'),
  ('83c98cb2-e082-4420-8e79-e2d1d7f94da0', 'transplant.somajiguda@yashodahospitals.com', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('8406c313-d12d-4552-a1c8-9a36ff4cf8f4', 'rohan.patel@patient.organdonation.in', NULL, 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-28 08:43:38', '2026-10-28 17:22:29'),
  ('84f0b314-c0a0-46fc-9760-70c8c3cfb39e', 'socket.hosp@hospital.org', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-10-24 11:01:20', '2026-10-24 11:01:20'),
  ('859e14af-d954-4f08-b9d0-5abc9625be26', 'nisha.gupta@patient.organdonation.in', NULL, 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-28 08:43:38', '2026-10-28 17:22:29'),
  ('8c79bce4-11fb-4f74-b7bd-fa0fb18b8000', 'transplant.blr@fortishealthcare.com', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('8de4586b-7736-4b47-871b-5008aaac41c1', 'user1@example.com', '$2b$10$8VaMX7zYfzRstzhczlYuA.e6sp.AnkLsiy2c.4ULpQDpnx49S3U3W', 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-23 17:05:58', '2026-10-23 17:06:33'),
  ('9363da13-b82c-4205-ba3e-06ff5993784a', 'manoj.joshi@patient.organdonation.in', NULL, 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-28 08:43:38', '2026-10-28 17:22:29'),
  ('93d75861-57ed-4780-9197-f852625a37e5', 'rajesh.kumar@patient.organdonation.in', NULL, 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-28 08:43:38', '2026-10-28 17:22:29'),
  ('952c2dad-dcdc-4440-9fe4-5415222e98b2', 'lakshmi.narayanan@patient.organdonation.in', NULL, 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-28 08:43:38', '2026-10-28 17:22:29'),
  ('97f1f2f5-ee3d-4f6f-8ea5-82f8bf5abf5d', 'organova@fortishealthcare.com', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('98a7039f-5871-48fe-8f9d-7dee856b11e8', 'transplant.chennai@gleneagles.com', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('99882cf2-0b05-4953-ae07-68c2ee10aa40', 'deepak.verma@patient.organdonation.in', NULL, 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-28 08:43:38', '2026-10-28 17:22:29'),
  ('99fef86d-d4b8-4803-b174-b6292e231ab3', 'admin@mastercontrol.local', '$2b$10$TbJDHQENmdorf2.29dSMi.3cwHrE5kYbvTw7aA4wSLPjeOPbBIC8S', 'ADMIN', 'LOCAL', NULL, 1, 1, NULL, '2026-10-23 19:22:32', '2026-10-29 20:15:09'),
  ('9a71417b-28fc-4a26-905c-1100f9265b81', 'trauma.care@cityhospital.com', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-10-25 06:55:57', '2026-10-25 06:55:57'),
  ('9bf823ff-2498-4965-97d0-1733b7d002fb', 'transplant.kolkata@apollohospitals.com', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('9c91d959-3900-4575-8fba-1ff550132993', 'socket.patient@citizen.org', '$2b$10$IQ/mdIE8f84SpyFfYApkmOQy6H/iia/TUlexZP6R6Dke599dNrqUK', 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-24 11:01:20', '2026-10-24 11:01:20'),
  ('a1f586d0-2989-4d41-a00e-7370a49e0f93', 'kem.mumbai@hospital.org', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-10-25 06:56:02', '2026-10-25 06:56:02'),
  ('b10b79af-d32e-495e-bd3a-4c563a348db0', 'p2@citizen.org', '$2b$10$wDsb7SwlpuzBBtDdvUf56u.8YuJBGt1.uwv7aSfCEuU1m.iY14GVC', 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-25 06:56:03', '2026-10-25 06:56:03')
ON DUPLICATE KEY UPDATE `password_hash` = VALUES(`password_hash`), `role` = VALUES(`role`), `is_active` = VALUES(`is_active`), `is_verified` = VALUES(`is_verified`), `avatar_url` = VALUES(`avatar_url`);

INSERT INTO `users` (`id`, `email`, `password_hash`, `role`, `auth_provider`, `google_id`, `is_active`, `is_verified`, `avatar_url`, `created_at`, `updated_at`) VALUES
  ('b3e9d07a-47be-4b4d-9c18-1a350789f3a5', 'aarav.sharma@patient.organdonation.in', NULL, 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-28 08:43:38', '2026-10-28 17:22:29'),
  ('b4702c0d-384d-47d6-95ad-80a5cc373dd2', 'transplant.care@continentalhospitals.com', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('c195dca0-ca6b-419a-8e9d-786170c15589', 'transplant@miotinternational.com', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('c1b03fc3-00cf-46ce-827c-66ebf1b97075', 'transplant.greams@apollohospitals.com', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('c75dca18-aa36-4e82-9dab-4ccee8d2ea81', 'transplant@carehospitals.com', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('c7a1794e-ee67-4883-829b-182a2e4e42bd', 'sanjay.singhania@patient.organdonation.in', NULL, 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-28 08:43:38', '2026-10-28 17:22:29'),
  ('ca60b6b4-67f7-4451-a3de-2d8da520e28b', 'pledge_revamp_1792946774033@example.com', '$2b$10$hoc/SlSyRfgTIG.Yz66C1OorrB34kpv6dZdiBKjHy8M1wVibLRgA6', 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-25 16:46:14', '2026-10-25 16:46:14'),
  ('cac346ad-e858-4ad7-befe-85122e532b53', 'organ.transplant@sgrh.com', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('ce0adc0b-290a-4e13-b118-7f24e7a5bd93', 'amit.deshmukh@gmail.com', '$2b$10$wDsb7SwlpuzBBtDdvUf56u.8YuJBGt1.uwv7aSfCEuU1m.iY14GVC', 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:17:23', '2026-11-05 17:17:23'),
  ('d228f870-721f-4430-ad10-b71298ba9d57', 'transplant.division@medanta.org', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('d34f2924-4cb8-4671-af54-70cf03f6c351', 'p3@citizen.org', '$2b$10$wDsb7SwlpuzBBtDdvUf56u.8YuJBGt1.uwv7aSfCEuU1m.iY14GVC', 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-25 06:56:03', '2026-10-25 06:56:03'),
  ('d4a76df4-d8c5-441a-8a97-0cfa2f899230', 'ramesh.test.1793182043288@organdonation.local', '$2b$10$P2aI2AuX9iDcvsgVo5vi/uSwY9wo/6rDvll1FTcrXNH1tE94nbS3m', 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-28 10:07:23', '2026-10-28 10:07:23'),
  ('dd680639-26d0-42c2-a810-c94655f0dd01', 'priya.sharma92@gmail.com', '$2b$10$wDsb7SwlpuzBBtDdvUf56u.8YuJBGt1.uwv7aSfCEuU1m.iY14GVC', 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:17:23', '2026-11-05 17:17:23'),
  ('e098f76d-5bab-4a8b-b055-657bda4b081d', 'transplant@jehangirhospital.com', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('e51d13db-31ab-4778-8c97-d07b951e811e', 'priya.nair@patient.organdonation.in', NULL, 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-28 08:43:38', '2026-10-28 17:22:29'),
  ('e94a5470-4197-4a38-b1cb-80dc09e75d7f', 'aiims.delhi@gov.in', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-10-25 06:13:30', '2026-10-25 06:13:30'),
  ('e9b68148-f104-4a24-87f0-72b0e33a7869', 'vikram.rao@gmail.com', '$2b$10$wDsb7SwlpuzBBtDdvUf56u.8YuJBGt1.uwv7aSfCEuU1m.iY14GVC', 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:17:23', '2026-11-05 17:17:23'),
  ('ed0d0cbc-d1ce-48d2-93cf-11c962a207f3', 'transplant.desk@hindujahospital.com', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('eecdb724-5679-43d3-9cc6-4a7ca50822da', 'redcross.hyd@bloodbank.org', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-10-25 06:55:57', '2026-11-01 18:32:12'),
  ('f653a6ee-2ec6-4ff8-9801-91722965452a', 'satya@example.com', '$2b$10$S7sx3EzaxY9.r88uvBjGS.XixFVzFbnbFF9WIP/litzHFEunsVWWq', 'USER', 'LOCAL', NULL, 1, 1, NULL, '2026-10-23 17:00:44', '2026-10-23 17:01:13'),
  ('fc4d1a0b-035d-4d27-9447-72d69914777f', 'transplant.care@zydushospitals.com', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  ('ff3ce11f-e9b5-4daf-b519-75dd8de8ad01', 'apollo.delhi@hospital.org', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-10-25 06:56:00', '2026-10-25 06:56:00'),
  ('ff58ca04-5a92-4fc0-95ac-f739b6a3e3d7', 'pending.test1793305135647@hospital.org', '$2b$10$S0brBaOB6PE85nzZns/HPui1KawwaipCqq/OHq8kOkgbX0iVcvYqC', 'HOSPITAL', 'LOCAL', NULL, 1, 1, NULL, '2026-10-29 20:18:55', '2026-10-29 20:18:55')
ON DUPLICATE KEY UPDATE `password_hash` = VALUES(`password_hash`), `role` = VALUES(`role`), `is_active` = VALUES(`is_active`), `is_verified` = VALUES(`is_verified`), `avatar_url` = VALUES(`avatar_url`);

-- --------------------------------------------------------------------
-- DATA FOR TABLE: citizen_profiles (34 rows)
-- --------------------------------------------------------------------
INSERT INTO `citizen_profiles` (`id`, `user_id`, `full_name`, `date_of_birth`, `gender`, `blood_group`, `phone_number`, `emergency_contact_name`, `emergency_contact_phone`, `address_line`, `city`, `state`, `pincode`, `avatar_url`, `created_at`) VALUES
  (1, '8de4586b-7736-4b47-871b-5008aaac41c1', 'Chittidi Satyanarayana', '2004-05-14 18:30:00', 'MALE', 'O+', '+91 94914 83994', 'S V V Satyanarayana', '+91 94914 83995', 'IIT ISM Campus', 'Dhanbad', 'Jharkhand', '826004', NULL, '2026-10-23 17:42:44'),
  (5, '9c91d959-3900-4575-8fba-1ff550132993', 'Rohan Kumar', '1995-05-14 18:30:00', 'MALE', 'O-', '+91-9876543210', 'Kin', '+91-9876543211', 'Address', 'Hyderabad', 'TS', '500081', NULL, '2026-10-24 11:01:20'),
  (9, '56c4338a-a957-4b0c-9255-4d51276862ed', 'Satyanarayana Chittidi', '2005-03-07 18:30:00', 'MALE', 'A+', '9491483994', 'Emergency Contact', '1234567890', '4-80, Near Chinna Vantena', 'Hyderabad', 'Telangana', '534302', NULL, '2026-10-24 11:44:06'),
  (35, '32d3e06c-4d0d-4390-919a-ea596bac1aab', '1', '0999-12-30 18:06:32', 'MALE', 'A+', '1', '1', '1', '4-80, Near Chinna Vantena', 'Madduru', 'Andhra Pradesh', '534302', '/uploads/avatars/avatar-32d3e06c-4d0d-4390-919a-ea596bac1aab-1792911729163.jpg', '2026-10-25 06:27:30'),
  (41, '442ec46a-0f73-40b9-8966-88d118e8ae7a', 'Rajesh Sharma (Pune ICU)', '1989-12-31 18:30:00', 'MALE', 'A+', '+91-9876543210', 'Kin', '+91-9876543211', 'Address', 'Pune', 'MH', '411001', NULL, '2026-10-25 06:56:03'),
  (42, 'b10b79af-d32e-495e-bd3a-4c563a348db0', 'Anita Verma (Delhi Emergency)', '1989-12-31 18:30:00', 'MALE', 'A+', '+91-9876543210', 'Kin', '+91-9876543211', 'Address', 'Pune', 'MH', '411001', NULL, '2026-10-25 06:56:03'),
  (43, 'd34f2924-4cb8-4671-af54-70cf03f6c351', 'Vikram Patel (Pune Routine)', '1989-12-31 18:30:00', 'MALE', 'A+', '+91-9876543210', 'Kin', '+91-9876543211', 'Address', 'Pune', 'MH', '411001', NULL, '2026-10-25 06:56:03'),
  (48, '810c59cf-da16-495c-afdb-c6e154d6777c', 'Jonh Doe', '2005-04-06 18:30:00', 'MALE', 'B+', '1234567890', 'Jaatu', '1234567890', 'My House, My Streer', 'My City', 'My Stata', 'PINCOD', NULL, '2026-10-25 08:44:28'),
  (57, '7645ee5b-8add-4ec7-b87b-2cc77d0d8ee5', 'Pledge Test User', '1995-05-14 18:30:00', 'MALE', 'O+', '+91-9876543210', 'Emergency Contact', '+91-9876543211', '123 Test St', 'Hyderabad', 'Telangana', '500001', NULL, '2026-10-25 16:46:25'),
  (59, '4b09173c-0b33-4f08-a21f-49a7e5f86192', 'No Pledge User', '1989-12-31 18:30:00', 'FEMALE', 'B+', '+91-9988776655', 'Contact Name', '+91-9988776654', 'Test Road', 'Delhi', 'Delhi', '110001', NULL, '2026-10-25 16:51:18'),
  (60, '598ff7e2-9b50-4fc3-949a-e4d2d76cc66d', 'bhaaai', '2026-10-25 18:30:00', 'MALE', 'B+', '9898989899', 'satyaaaaa', '9779797999', 'dhanabd', 'dhanbad', 'jharkhand', '111111', NULL, '2026-10-26 14:07:19'),
  (61, 'b3e9d07a-47be-4b4d-9c18-1a350789f3a5', 'Aarav Sharma', '1984-06-14 18:30:00', 'MALE', 'O+', '9876543210', 'Primary Guardian', '9876543211', 'Transplant Inpatient Ward', 'Regional Center', 'State', '500001', NULL, '2026-10-28 08:43:38'),
  (62, 'e51d13db-31ab-4778-8c97-d07b951e811e', 'Priya Nair', '1991-03-21 18:30:00', 'FEMALE', 'O+', '9876543210', 'Primary Guardian', '9876543211', 'Transplant Inpatient Ward', 'Regional Center', 'State', '500001', NULL, '2026-10-28 08:43:38'),
  (63, '8406c313-d12d-4552-a1c8-9a36ff4cf8f4', 'Rohan Patel', '1979-11-07 18:30:00', 'MALE', 'A+', '9876543210', 'Primary Guardian', '9876543211', 'Transplant Inpatient Ward', 'Regional Center', 'State', '500001', NULL, '2026-10-28 08:43:38'),
  (64, '25099de0-538e-4920-ad88-aa76c83aac75', 'Meera Deshmukh', '1986-09-13 18:30:00', 'FEMALE', 'B+', '9876543210', 'Primary Guardian', '9876543211', 'Transplant Inpatient Ward', 'Regional Center', 'State', '500001', NULL, '2026-10-28 08:43:38'),
  (65, '1d8e07d7-6420-49ed-a07e-d14db4dc9081', 'Vikram Malhotra', '1975-01-29 18:30:00', 'MALE', 'AB+', '9876543210', 'Primary Guardian', '9876543211', 'Transplant Inpatient Ward', 'Regional Center', 'State', '500001', NULL, '2026-10-28 08:43:38'),
  (66, '4674df15-aa24-44ca-90e1-951f22c3a115', 'Ananya Iyer', '1995-12-03 18:30:00', 'FEMALE', 'O-', '9876543210', 'Primary Guardian', '9876543211', 'Transplant Inpatient Ward', 'Regional Center', 'State', '500001', NULL, '2026-10-28 08:43:38'),
  (67, '93d75861-57ed-4780-9197-f852625a37e5', 'Rajesh Kumar', '1970-07-18 18:30:00', 'MALE', 'O+', '9876543210', 'Primary Guardian', '9876543211', 'Transplant Inpatient Ward', 'Regional Center', 'State', '500001', NULL, '2026-10-28 08:43:38'),
  (68, '2e969834-dbfa-42c8-b83a-763d27ed758c', 'Sunita Roy', '1982-04-10 18:30:00', 'FEMALE', 'B+', '9876543210', 'Primary Guardian', '9876543211', 'Transplant Inpatient Ward', 'Regional Center', 'State', '500001', NULL, '2026-10-28 08:43:38'),
  (69, '5bf3c5d0-6259-4c65-b36c-c4a3bf2afbcf', 'Amitabh Sen', '1968-08-24 18:30:00', 'MALE', 'A+', '9876543210', 'Primary Guardian', '9876543211', 'Transplant Inpatient Ward', 'Regional Center', 'State', '500001', NULL, '2026-10-28 08:43:38'),
  (70, '99882cf2-0b05-4953-ae07-68c2ee10aa40', 'Deepak Verma', '1988-10-01 18:30:00', 'MALE', 'O+', '9876543210', 'Primary Guardian', '9876543211', 'Transplant Inpatient Ward', 'Regional Center', 'State', '500001', NULL, '2026-10-28 08:43:38'),
  (71, '53a41ccb-aea7-407a-8f83-0a38e8d70885', 'Kavita Reddy', '1992-05-17 18:30:00', 'FEMALE', 'A-', '9876543210', 'Primary Guardian', '9876543211', 'Transplant Inpatient Ward', 'Regional Center', 'State', '500001', NULL, '2026-10-28 08:43:38'),
  (72, '207063e9-795a-400a-b359-d35368699540', 'Harish Pillai', '1974-12-11 18:30:00', 'MALE', 'O+', '9876543210', 'Primary Guardian', '9876543211', 'Transplant Inpatient Ward', 'Regional Center', 'State', '500001', NULL, '2026-10-28 08:43:38'),
  (73, '859e14af-d954-4f08-b9d0-5abc9625be26', 'Nisha Gupta', '1980-02-13 18:30:00', 'FEMALE', 'A+', '9876543210', 'Primary Guardian', '9876543211', 'Transplant Inpatient Ward', 'Regional Center', 'State', '500001', NULL, '2026-10-28 08:43:38'),
  (74, '9363da13-b82c-4205-ba3e-06ff5993784a', 'Manoj Joshi', '1998-07-06 18:30:00', 'MALE', 'O-', '9876543210', 'Primary Guardian', '9876543211', 'Transplant Inpatient Ward', 'Regional Center', 'State', '500001', NULL, '2026-10-28 08:43:38'),
  (75, '952c2dad-dcdc-4440-9fe4-5415222e98b2', 'Lakshmi Narayanan', '1965-03-08 18:30:00', 'FEMALE', 'B+', '9876543210', 'Primary Guardian', '9876543211', 'Transplant Inpatient Ward', 'Regional Center', 'State', '500001', NULL, '2026-10-28 08:43:38'),
  (76, 'c7a1794e-ee67-4883-829b-182a2e4e42bd', 'Sanjay Singhania', '1960-11-19 18:30:00', 'MALE', 'O+', '9876543210', 'Primary Guardian', '9876543211', 'Transplant Inpatient Ward', 'Regional Center', 'State', '500001', NULL, '2026-10-28 08:43:38'),
  (77, '003740d6-8857-40b3-b3af-0fd43f125a4b', 'Gaurav Bhatt', '1989-09-02 18:30:00', 'MALE', 'O+', '9876543210', 'Primary Guardian', '9876543211', 'Transplant Inpatient Ward', 'Regional Center', 'State', '500001', NULL, '2026-10-28 08:43:38'),
  (78, 'd4a76df4-d8c5-441a-8a97-0cfa2f899230', 'Ramesh Patel', '1985-04-11 18:30:00', 'MALE', 'B+', '9876543210', 'Hospital Attendant', '9876543210', 'Registered via Hospital Master Control', 'Hyderabad', 'Telangana', '500081', NULL, '2026-10-28 10:07:23'),
  (130, 'dd680639-26d0-42c2-a810-c94655f0dd01', 'Priya Sharma', '1992-04-11 18:30:00', 'FEMALE', 'A+', '+91 98480 22334', 'Emergency Contact', '+91 9988776655', 'Flat 402, Sai Vihar, Madhapur', 'Hyderabad', 'Telangana', '500081', NULL, '2026-11-05 17:17:23'),
  (131, '56305174-4bd5-4ffe-838a-ff64d26d31e1', 'Kavita Reddy', '1989-11-22 18:30:00', 'FEMALE', 'AB+', '+91 98765 43211', 'Emergency Contact', '+91 9988776655', 'Plot 88, Financial District, Nanakramguda', 'Hyderabad', 'Telangana', '500032', NULL, '2026-11-05 17:17:23'),
  (132, '3f079d05-fcc8-411a-ba6e-9004526a2f21', 'Rahul Verma', '1987-08-18 18:30:00', 'MALE', 'A+', '+91 91234 56789', 'Emergency Contact', '+91 9988776655', 'House 12-4-88, Banjara Hills Road No. 10', 'Hyderabad', 'Telangana', '500034', NULL, '2026-11-05 17:17:23'),
  (133, 'e9b68148-f104-4a24-87f0-72b0e33a7869', 'Dr. Vikram Rao', '1980-02-14 18:30:00', 'MALE', 'B+', '+91 99887 76655', 'Emergency Contact', '+91 9988776655', 'Villa 54, Jubilee Hills', 'Hyderabad', 'Telangana', '500033', NULL, '2026-11-05 17:17:23'),
  (134, 'ce0adc0b-290a-4e13-b118-7f24e7a5bd93', 'Amit Deshmukh', '1995-06-29 18:30:00', 'MALE', 'A+', '+91 94401 23456', 'Emergency Contact', '+91 9988776655', 'Apartment 304, Green Meadows, Kondapur', 'Hyderabad', 'Telangana', '500084', NULL, '2026-11-05 17:17:23')
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`), `date_of_birth` = VALUES(`date_of_birth`), `gender` = VALUES(`gender`), `blood_group` = VALUES(`blood_group`), `phone_number` = VALUES(`phone_number`), `emergency_contact_name` = VALUES(`emergency_contact_name`), `emergency_contact_phone` = VALUES(`emergency_contact_phone`), `address_line` = VALUES(`address_line`), `city` = VALUES(`city`), `state` = VALUES(`state`), `pincode` = VALUES(`pincode`), `avatar_url` = VALUES(`avatar_url`);

-- --------------------------------------------------------------------
-- DATA FOR TABLE: medical_hubs (34 rows)
-- --------------------------------------------------------------------
INSERT INTO `medical_hubs` (`id`, `user_id`, `hub_type`, `name`, `license_number`, `contact_phone`, `address_line`, `city`, `state`, `pincode`, `latitude`, `longitude`, `verification_status`, `verified_by_admin_id`, `verified_at`, `created_at`) VALUES
  (9, '84f0b314-c0a0-46fc-9760-70c8c3cfb39e', 'HOSPITAL', 'City Trauma & Transplant Center', 'SOCKET-HOSP-01', '+91-9988112233', 'Health City Rd', 'Hyderabad', 'Telangana', '500081', '17.44850000', '78.37410000', 'ACTIVE', '99fef86d-d4b8-4803-b174-b6292e231ab3', '2026-10-24 11:01:20', '2026-10-24 11:01:20'),
  (20, 'e94a5470-4197-4a38-b1cb-80dc09e75d7f', 'HOSPITAL', 'All India Institute of Medical Sciences (AIIMS)', 'AIIMS-ND-2026', '+91-11-26588500', 'Sri Aurobindo Marg, Ansari Nagar', 'New Delhi', 'Delhi', '110029', '28.56720000', '77.21000000', 'ACTIVE', '99fef86d-d4b8-4803-b174-b6292e231ab3', '2026-10-25 06:13:31', '2026-10-25 06:13:30'),
  (26, 'eecdb724-5679-43d3-9cc6-4a7ca50822da', 'HOSPITAL', 'Red Cross Central Blood Bank', 'RC-HYD-BB-2026', '+91-40-23456789', 'Red Cross Bhavan, Banjara Hills', 'Hyderabad', 'Telangana', '500034', '17.41560000', '78.43520000', 'ACTIVE', '99fef86d-d4b8-4803-b174-b6292e231ab3', '2026-10-25 06:55:57', '2026-10-25 06:55:57'),
  (27, '9a71417b-28fc-4a26-905c-1100f9265b81', 'HOSPITAL', 'City Trauma Emergency Hospital', 'TRAUMA-HYD-01', '+91-40-99887766', 'Gachibowli Main Rd', 'Hyderabad', 'Telangana', '500032', '17.44010000', '78.34890000', 'ACTIVE', '99fef86d-d4b8-4803-b174-b6292e231ab3', '2026-10-25 06:55:57', '2026-10-25 06:55:57'),
  (28, 'ff3ce11f-e9b5-4daf-b519-75dd8de8ad01', 'HOSPITAL', 'Apollo Multi-Specialty Transplant Center', 'APOLLO-DELHI-CIT-01', '+91-11-29871122', 'Sarita Vihar, Mathura Rd', 'New Delhi', 'Delhi', '110076', '28.53550000', '77.29100000', 'ACTIVE', '99fef86d-d4b8-4803-b174-b6292e231ab3', '2026-10-25 06:56:00', '2026-10-25 06:56:00'),
  (29, 'a1f586d0-2989-4d41-a00e-7370a49e0f93', 'HOSPITAL', 'KEM Hospital Mumbai', 'MUM-KEM-01', '+91-9988776655', 'Main Hospital Road', 'Mumbai', 'State', '400001', '18.99860000', '72.84280000', 'ACTIVE', '99fef86d-d4b8-4803-b174-b6292e231ab3', '2026-10-25 06:56:02', '2026-10-25 06:56:02'),
  (30, '5ff051d2-7a55-490e-9997-b370be9bdd0b', 'HOSPITAL', 'Ruby Hall Clinic Pune', 'PUNE-RUBY-01', '+91-9988776655', 'Main Hospital Road', 'Pune', 'State', '400001', '18.53280000', '73.87260000', 'ACTIVE', '99fef86d-d4b8-4803-b174-b6292e231ab3', '2026-10-25 06:56:03', '2026-10-25 06:56:03'),
  (31, 'ff58ca04-5a92-4fc0-95ac-f739b6a3e3d7', 'HOSPITAL', 'St. Jude Test Medical Center', 'TEST-PENDING-1793305135647', '+91-9876543210', '123 Test St', 'Hyderabad', 'Telangana', '500001', '17.38500000', '78.48670000', 'ACTIVE', '99fef86d-d4b8-4803-b174-b6292e231ab3', '2026-11-01 11:50:15', '2026-10-29 20:18:55'),
  (32, '2132ce28-ce0c-44c4-9489-279d29b1da67', 'HOSPITAL', 'Nizam\'s Institute of Medical Sciences (NIMS)', 'MHUB-TS-HYD-001', '+91 40 2348 9000', 'Punjagutta, Somajiguda', 'Hyderabad', 'Telangana', '500082', '17.42220000', '78.45270000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (33, '83c98cb2-e082-4420-8e79-e2d1d7f94da0', 'HOSPITAL', 'Yashoda Hospitals Somajiguda', 'MHUB-TS-HYD-002', '+91 40 4567 4567', 'Raj Bhavan Road, Matha Nagar, Somajiguda', 'Hyderabad', 'Telangana', '500082', '17.42650000', '78.45780000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (34, 'b4702c0d-384d-47d6-95ad-80a5cc373dd2', 'HOSPITAL', 'Continental Hospitals Financial District', 'MHUB-TS-HYD-003', '+91 40 6700 0000', 'Plot No. 3, Road No. 2, IT & Financial District, Nanakramguda', 'Hyderabad', 'Telangana', '500032', '17.41770000', '78.34440000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (35, 'c75dca18-aa36-4e82-9dab-4ccee8d2ea81', 'HOSPITAL', 'CARE Hospitals Banjara Hills', 'MHUB-TS-HYD-004', '+91 40 6165 6565', 'Road No. 1, Prem Nagar, Banjara Hills', 'Hyderabad', 'Telangana', '500034', '17.41560000', '78.44820000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (36, 'cac346ad-e858-4ad7-befe-85122e532b53', 'HOSPITAL', 'Sir Ganga Ram Hospital', 'MHUB-DL-DEL-001', '+91 11 2575 0000', 'Sir Ganga Ram Hospital Marg, Old Rajinder Nagar', 'New Delhi', 'Delhi', '110060', '28.63850000', '77.18950000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (37, '4cb889ce-5e5f-4548-a9ec-03431ff2d0bf', 'HOSPITAL', 'Max Super Speciality Hospital Saket', 'MHUB-DL-DEL-002', '+91 11 2651 5050', '1, 2, Press Enclave Marg, Saket Institutional Area', 'New Delhi', 'Delhi', '110017', '28.52730000', '77.21520000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (38, '97f1f2f5-ee3d-4f6f-8ea5-82f8bf5abf5d', 'HOSPITAL', 'Fortis Memorial Research Institute (FMRI)', 'MHUB-HR-GGN-001', '+91 124 496 2200', 'Sector 44, Opposite HUDA City Centre Metro Station', 'Gurugram', 'Haryana', '122002', '28.45950000', '77.07250000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (39, 'd228f870-721f-4430-ad10-b71298ba9d57', 'HOSPITAL', 'Medanta - The Medicity', 'MHUB-HR-GGN-002', '+91 124 414 1414', 'CH Bakhtawar Singh Road, Sector 38', 'Gurugram', 'Haryana', '122001', '28.43900000', '77.04280000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (40, '1d1e9c71-22ce-4539-8d99-b95098a6667e', 'HOSPITAL', 'Tata Memorial Hospital & Cancer Institute', 'MHUB-MH-MUM-001', '+91 22 2417 7000', 'Dr. E Borges Road, Parel East', 'Mumbai', 'Maharashtra', '400012', '19.00410000', '72.84320000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (41, '04406dfa-6c7d-4ec8-b5ff-b0ee45a51bf2', 'HOSPITAL', 'Lilavati Hospital & Research Centre', 'MHUB-MH-MUM-002', '+91 22 2675 1000', 'A-791, Bandra Reclamation Rd, Bandra West', 'Mumbai', 'Maharashtra', '400050', '19.05190000', '72.82950000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (42, '19f4335b-a006-42c5-b0e8-1a14aea06014', 'HOSPITAL', 'Kokilaben Dhirubhai Ambani Hospital', 'MHUB-MH-MUM-003', '+91 22 4269 6969', 'Rao Saheb, Achutrao Patwardhan Marg, Four Bungalows, Andheri West', 'Mumbai', 'Maharashtra', '400053', '19.13140000', '72.82520000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (43, 'ed0d0cbc-d1ce-48d2-93cf-11c962a207f3', 'HOSPITAL', 'P. D. Hinduja National Hospital', 'MHUB-MH-MUM-004', '+91 22 2445 1515', 'Veer Savarkar Marg, Mahim West', 'Mumbai', 'Maharashtra', '400016', '19.03300000', '72.84020000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (44, '2f58b970-401f-4573-ac2a-8b3c00b7c7dd', 'HOSPITAL', 'Narayana Institute of Cardiac Sciences', 'MHUB-KA-BLR-001', '+91 80 7122 2222', '258/A, Bommasandra Industrial Area, Anekal Taluk', 'Bengaluru', 'Karnataka', '560099', '12.80160000', '77.69740000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (45, '36ab4c5f-38d6-43af-a278-057ed4f931e2', 'HOSPITAL', 'Manipal Hospital Old Airport Road', 'MHUB-KA-BLR-002', '+91 80 2502 4444', '98, HAL Old Airport Rd, Kodihalli', 'Bengaluru', 'Karnataka', '560017', '12.95920000', '77.65340000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (46, '4e2e028b-2909-4e2a-8049-7ea5e0cdafdb', 'HOSPITAL', 'Aster CMI Hospital Hebbal', 'MHUB-KA-BLR-003', '+91 80 4342 0100', 'No. 43/42, NH 44, Sahakar Nagar, Hebbal', 'Bengaluru', 'Karnataka', '560092', '13.05600000', '77.59250000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (47, '8c79bce4-11fb-4f74-b7bd-fa0fb18b8000', 'HOSPITAL', 'Fortis Hospital Bannerghatta Road', 'MHUB-KA-BLR-004', '+91 80 6621 4444', '154/9, Bannerghatta Main Rd, Opposite IIMB', 'Bengaluru', 'Karnataka', '560076', '12.89420000', '77.59820000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (48, 'c1b03fc3-00cf-46ce-827c-66ebf1b97075', 'HOSPITAL', 'Apollo Hospital Greams Road', 'MHUB-TN-CHN-001', '+91 44 2829 0200', '21 Greams Lane, Off Greams Road, Thousand Lights', 'Chennai', 'Tamil Nadu', '600006', '13.05560000', '80.25200000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (49, '26de60b9-1d77-4666-86dc-09169c5abacd', 'HOSPITAL', 'Christian Medical College (CMC) Vellore Center', 'MHUB-TN-VEL-001', '+91 416 228 1000', 'Ida Scudder Road, Vellore', 'Vellore', 'Tamil Nadu', '632004', '12.92460000', '79.13500000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (50, 'c195dca0-ca6b-419a-8e9d-786170c15589', 'HOSPITAL', 'MIOT International Multi-Speciality Hospital', 'MHUB-TN-CHN-002', '+91 44 4200 2288', '4/112, Mount Poonamallee High Rd, Manapakkam', 'Chennai', 'Tamil Nadu', '600089', '13.02320000', '80.18340000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (51, '98a7039f-5871-48fe-8f9d-7dee856b11e8', 'HOSPITAL', 'Gleneagles Global Health City', 'MHUB-TN-CHN-003', '+91 44 4477 7000', '439, Cheran Nagar, Perumbakkam', 'Chennai', 'Tamil Nadu', '600100', '12.90220000', '80.20180000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (52, 'e098f76d-5bab-4a8b-b055-657bda4b081d', 'HOSPITAL', 'Jehangir Hospital Pune', 'MHUB-MH-PUN-001', '+91 20 6681 9999', '32, Sasoon Road, Opposite Pune Railway Station', 'Pune', 'Maharashtra', '411001', '18.52840000', '73.87440000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (53, '44e8f9f0-bd62-49aa-a8b2-9a6f67429fc0', 'HOSPITAL', 'Medica Superspecialty Hospital', 'MHUB-WB-KOL-001', '+91 33 6652 0000', '127, Mukundapur, E.M. Bypass', 'Kolkata', 'West Bengal', '700099', '22.49880000', '88.39760000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (54, '9bf823ff-2498-4965-97d0-1733b7d002fb', 'HOSPITAL', 'Apollo Multispeciality Hospital Kolkata', 'MHUB-WB-KOL-002', '+91 33 2320 3040', '58, Canal Circular Road, Kadapara, Phool Bagan', 'Kolkata', 'West Bengal', '700054', '22.56970000', '88.40420000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (55, 'fc4d1a0b-035d-4d27-9447-72d69914777f', 'HOSPITAL', 'Zydus Hospital SG Highway', 'MHUB-GJ-AHM-001', '+91 79 6619 0201', 'Zydus Hospital Road, SG Highway, Thaltej', 'Ahmedabad', 'Gujarat', '380054', '23.07220000', '72.52550000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (56, '5c43676b-babf-47fd-94eb-f09e795ff14f', 'HOSPITAL', 'Post Graduate Institute of Medical Education & Research (PGIMER)', 'MHUB-CH-CHD-001', '+91 172 274 7585', 'Sector 12, Madhya Marg', 'Chandigarh', 'Chandigarh', '160012', '30.76510000', '76.77660000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19'),
  (57, '4228dbae-b4b7-4eb4-a494-7c75b2ccf52e', 'HOSPITAL', 'Amrita Institute of Medical Sciences (AIMS)', 'MHUB-KL-COK-001', '+91 484 285 1234', 'AIMS Ponekkara P.O., Edappally', 'Kochi', 'Kerala', '682041', '10.03260000', '76.29990000', 'ACTIVE', NULL, '2026-11-05 17:02:19', '2026-11-05 17:02:19')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `license_number` = VALUES(`license_number`), `contact_phone` = VALUES(`contact_phone`), `address_line` = VALUES(`address_line`), `city` = VALUES(`city`), `state` = VALUES(`state`), `pincode` = VALUES(`pincode`), `latitude` = VALUES(`latitude`), `longitude` = VALUES(`longitude`), `verification_status` = VALUES(`verification_status`);

-- --------------------------------------------------------------------
-- DATA FOR TABLE: donor_pledges (45 rows)
-- --------------------------------------------------------------------
INSERT INTO `donor_pledges` (`id`, `user_id`, `organ_type_id`, `consent_type`, `pledge_date`, `status`) VALUES
  (1, '8de4586b-7736-4b47-871b-5008aaac41c1', 1, 'DECEASED_ONLY', '2026-10-23 18:21:04', 'REVOKED'),
  (2, '8de4586b-7736-4b47-871b-5008aaac41c1', 4, 'LIVING_ALLOWED', '2026-10-23 18:45:40', 'ACTIVE'),
  (3, '8de4586b-7736-4b47-871b-5008aaac41c1', 6, 'DECEASED_ONLY', '2026-10-28 17:32:28', 'ACTIVE'),
  (4, '8de4586b-7736-4b47-871b-5008aaac41c1', 8, 'LIVING_ALLOWED', '2026-10-23 18:21:04', 'REVOKED'),
  (6, '8de4586b-7736-4b47-871b-5008aaac41c1', 4, 'DECEASED_ONLY', '2026-10-28 17:32:28', 'ACTIVE'),
  (8, '56c4338a-a957-4b0c-9255-4d51276862ed', 3, 'LIVING_ALLOWED', '2026-10-24 11:47:22', 'ACTIVE'),
  (9, '56c4338a-a957-4b0c-9255-4d51276862ed', 4, 'LIVING_ALLOWED', '2026-10-24 11:47:22', 'ACTIVE'),
  (10, '56c4338a-a957-4b0c-9255-4d51276862ed', 8, 'LIVING_ALLOWED', '2026-11-05 17:09:18', 'ACTIVE'),
  (11, '56c4338a-a957-4b0c-9255-4d51276862ed', 1, 'DECEASED_ONLY', '2026-11-05 17:09:18', 'ACTIVE'),
  (12, '56c4338a-a957-4b0c-9255-4d51276862ed', 2, 'DECEASED_ONLY', '2026-11-05 17:09:18', 'ACTIVE'),
  (13, '56c4338a-a957-4b0c-9255-4d51276862ed', 3, 'DECEASED_ONLY', '2026-11-05 17:09:18', 'ACTIVE'),
  (14, '56c4338a-a957-4b0c-9255-4d51276862ed', 4, 'DECEASED_ONLY', '2026-11-05 17:09:18', 'ACTIVE'),
  (15, '56c4338a-a957-4b0c-9255-4d51276862ed', 8, 'DECEASED_ONLY', '2026-11-05 17:09:18', 'ACTIVE'),
  (16, '56c4338a-a957-4b0c-9255-4d51276862ed', 7, 'DECEASED_ONLY', '2026-11-05 17:09:18', 'ACTIVE'),
  (17, '56c4338a-a957-4b0c-9255-4d51276862ed', 5, 'DECEASED_ONLY', '2026-11-05 17:09:18', 'ACTIVE'),
  (18, '56c4338a-a957-4b0c-9255-4d51276862ed', 6, 'DECEASED_ONLY', '2026-11-05 17:09:18', 'ACTIVE'),
  (39, '32d3e06c-4d0d-4390-919a-ea596bac1aab', 4, 'LIVING_ALLOWED', '2026-10-25 06:37:02', 'ACTIVE'),
  (40, '32d3e06c-4d0d-4390-919a-ea596bac1aab', 3, 'LIVING_ALLOWED', '2026-10-25 18:10:50', 'ACTIVE'),
  (53, '32d3e06c-4d0d-4390-919a-ea596bac1aab', 4, 'DECEASED_ONLY', '2026-10-25 18:10:50', 'ACTIVE'),
  (54, '32d3e06c-4d0d-4390-919a-ea596bac1aab', 3, 'DECEASED_ONLY', '2026-10-25 18:10:50', 'ACTIVE'),
  (63, '32d3e06c-4d0d-4390-919a-ea596bac1aab', 7, 'LIVING_ALLOWED', '2026-10-25 18:10:50', 'ACTIVE'),
  (64, '32d3e06c-4d0d-4390-919a-ea596bac1aab', 8, 'LIVING_ALLOWED', '2026-10-25 18:10:50', 'ACTIVE'),
  (65, '32d3e06c-4d0d-4390-919a-ea596bac1aab', 1, 'DECEASED_ONLY', '2026-10-25 18:10:50', 'ACTIVE'),
  (66, '32d3e06c-4d0d-4390-919a-ea596bac1aab', 2, 'DECEASED_ONLY', '2026-10-25 18:10:50', 'ACTIVE'),
  (67, '32d3e06c-4d0d-4390-919a-ea596bac1aab', 5, 'DECEASED_ONLY', '2026-10-25 18:10:50', 'ACTIVE'),
  (68, '32d3e06c-4d0d-4390-919a-ea596bac1aab', 6, 'DECEASED_ONLY', '2026-10-25 18:10:50', 'ACTIVE'),
  (69, '32d3e06c-4d0d-4390-919a-ea596bac1aab', 7, 'DECEASED_ONLY', '2026-10-25 18:10:50', 'ACTIVE'),
  (70, '32d3e06c-4d0d-4390-919a-ea596bac1aab', 8, 'DECEASED_ONLY', '2026-10-25 18:10:50', 'ACTIVE'),
  (83, '810c59cf-da16-495c-afdb-c6e154d6777c', 3, 'LIVING_ALLOWED', '2026-11-01 12:27:51', 'ACTIVE'),
  (84, '810c59cf-da16-495c-afdb-c6e154d6777c', 4, 'LIVING_ALLOWED', '2026-11-01 12:27:51', 'ACTIVE'),
  (97, '810c59cf-da16-495c-afdb-c6e154d6777c', 2, 'DECEASED_ONLY', '2026-11-01 12:27:51', 'ACTIVE'),
  (98, '810c59cf-da16-495c-afdb-c6e154d6777c', 3, 'DECEASED_ONLY', '2026-11-01 12:27:51', 'ACTIVE'),
  (182, '7645ee5b-8add-4ec7-b87b-2cc77d0d8ee5', 4, 'LIVING_ALLOWED', '2026-10-25 16:46:25', 'REVOKED'),
  (183, '7645ee5b-8add-4ec7-b87b-2cc77d0d8ee5', 1, 'DECEASED_ONLY', '2026-10-25 16:46:25', 'REVOKED'),
  (185, '7645ee5b-8add-4ec7-b87b-2cc77d0d8ee5', 6, 'DECEASED_ONLY', '2026-10-25 16:46:25', 'ACTIVE'),
  (188, '810c59cf-da16-495c-afdb-c6e154d6777c', 1, 'DECEASED_ONLY', '2026-11-01 12:27:51', 'ACTIVE'),
  (190, '810c59cf-da16-495c-afdb-c6e154d6777c', 7, 'LIVING_ALLOWED', '2026-11-01 12:27:51', 'ACTIVE'),
  (207, '810c59cf-da16-495c-afdb-c6e154d6777c', 7, 'DECEASED_ONLY', '2026-11-01 12:27:51', 'ACTIVE'),
  (212, '598ff7e2-9b50-4fc3-949a-e4d2d76cc66d', 3, 'LIVING_ALLOWED', '2026-10-26 14:07:43', 'ACTIVE'),
  (213, '598ff7e2-9b50-4fc3-949a-e4d2d76cc66d', 6, 'DECEASED_ONLY', '2026-10-26 14:07:43', 'ACTIVE'),
  (225, '810c59cf-da16-495c-afdb-c6e154d6777c', 8, 'LIVING_ALLOWED', '2026-11-01 12:27:51', 'ACTIVE'),
  (227, '810c59cf-da16-495c-afdb-c6e154d6777c', 4, 'DECEASED_ONLY', '2026-11-01 12:27:51', 'ACTIVE'),
  (229, '810c59cf-da16-495c-afdb-c6e154d6777c', 5, 'DECEASED_ONLY', '2026-11-01 12:27:51', 'ACTIVE'),
  (230, '810c59cf-da16-495c-afdb-c6e154d6777c', 6, 'DECEASED_ONLY', '2026-11-01 12:27:51', 'ACTIVE'),
  (232, '810c59cf-da16-495c-afdb-c6e154d6777c', 8, 'DECEASED_ONLY', '2026-11-01 12:27:51', 'ACTIVE')
ON DUPLICATE KEY UPDATE `consent_type` = VALUES(`consent_type`), `status` = VALUES(`status`);

-- --------------------------------------------------------------------
-- DATA FOR TABLE: blood_inventory (131 rows)
-- --------------------------------------------------------------------
INSERT INTO `blood_inventory` (`id`, `hub_id`, `blood_group`, `component`, `units_available`, `last_updated`) VALUES
  (4, 9, 'O-', 'PACKED_RBC', 8, '2026-10-24 11:01:20'),
  (11, 26, 'O-', 'PACKED_RBC', 10, '2026-10-25 06:55:58'),
  (12, 26, 'B+', 'PLATELETS', 15, '2026-10-25 06:55:58'),
  (14, 27, 'A+', 'WHOLE_BLOOD', 36, '2026-11-05 17:10:05'),
  (28, 27, 'A+', 'PLATELETS', 19, '2026-11-05 17:10:05'),
  (31, 27, 'A+', 'PACKED_RBC', 38, '2026-11-05 17:10:05'),
  (43, 28, 'O+', 'WHOLE_BLOOD', 32, '2026-11-05 17:10:05'),
  (44, 27, 'O+', 'WHOLE_BLOOD', 42, '2026-11-05 17:10:05'),
  (45, 27, 'O+', 'PACKED_RBC', 48, '2026-11-05 17:10:05'),
  (46, 27, 'O+', 'PLATELETS', 24, '2026-11-05 17:10:05'),
  (47, 27, 'O+', 'PLASMA', 32, '2026-11-05 17:10:05'),
  (51, 27, 'A+', 'PLASMA', 26, '2026-11-05 17:10:05'),
  (52, 27, 'B+', 'WHOLE_BLOOD', 38, '2026-11-05 17:10:05'),
  (53, 27, 'B+', 'PACKED_RBC', 44, '2026-11-05 17:10:05'),
  (54, 27, 'B+', 'PLATELETS', 22, '2026-11-05 17:10:05'),
  (55, 27, 'B+', 'PLASMA', 28, '2026-11-05 17:10:05'),
  (56, 27, 'AB+', 'WHOLE_BLOOD', 18, '2026-11-05 17:10:05'),
  (57, 27, 'AB+', 'PACKED_RBC', 22, '2026-11-05 17:10:05'),
  (58, 27, 'AB+', 'PLATELETS', 14, '2026-11-05 17:10:05'),
  (59, 27, 'AB+', 'PLASMA', 35, '2026-11-05 17:10:05'),
  (60, 27, 'O-', 'WHOLE_BLOOD', 15, '2026-11-05 17:10:05'),
  (61, 27, 'O-', 'PACKED_RBC', 18, '2026-11-05 17:10:05'),
  (62, 27, 'O-', 'PLATELETS', 11, '2026-11-05 17:10:05'),
  (63, 27, 'O-', 'PLASMA', 14, '2026-11-05 17:10:05'),
  (64, 27, 'A-', 'WHOLE_BLOOD', 10, '2026-11-05 17:10:05'),
  (65, 27, 'A-', 'PACKED_RBC', 14, '2026-11-05 17:10:05'),
  (66, 27, 'A-', 'PLATELETS', 8, '2026-11-05 17:10:05'),
  (67, 27, 'A-', 'PLASMA', 10, '2026-11-05 17:10:05'),
  (68, 27, 'B-', 'WHOLE_BLOOD', 9, '2026-11-05 17:10:05'),
  (69, 27, 'B-', 'PACKED_RBC', 12, '2026-11-05 17:10:05'),
  (70, 27, 'B-', 'PLATELETS', 7, '2026-11-05 17:10:05'),
  (71, 27, 'B-', 'PLASMA', 9, '2026-11-05 17:10:05'),
  (72, 27, 'AB-', 'WHOLE_BLOOD', 6, '2026-11-05 17:10:05'),
  (73, 27, 'AB-', 'PACKED_RBC', 8, '2026-11-05 17:10:05'),
  (74, 27, 'AB-', 'PLATELETS', 5, '2026-11-05 17:10:05'),
  (75, 27, 'AB-', 'PLASMA', 7, '2026-11-05 17:10:05'),
  (76, 20, 'O+', 'WHOLE_BLOOD', 32, '2026-11-05 17:10:05'),
  (77, 20, 'O+', 'PACKED_RBC', 36, '2026-11-05 17:10:05'),
  (78, 20, 'O+', 'PLATELETS', 18, '2026-11-05 17:10:05'),
  (79, 20, 'O+', 'PLASMA', 24, '2026-11-05 17:10:05'),
  (80, 20, 'A+', 'WHOLE_BLOOD', 27, '2026-11-05 17:10:05'),
  (81, 20, 'A+', 'PACKED_RBC', 29, '2026-11-05 17:10:05'),
  (82, 20, 'A+', 'PLATELETS', 14, '2026-11-05 17:10:05'),
  (83, 20, 'A+', 'PLASMA', 20, '2026-11-05 17:10:05'),
  (84, 20, 'B+', 'WHOLE_BLOOD', 29, '2026-11-05 17:10:05'),
  (85, 20, 'B+', 'PACKED_RBC', 33, '2026-11-05 17:10:05'),
  (86, 20, 'B+', 'PLATELETS', 17, '2026-11-05 17:10:05'),
  (87, 20, 'B+', 'PLASMA', 21, '2026-11-05 17:10:05'),
  (88, 20, 'AB+', 'WHOLE_BLOOD', 14, '2026-11-05 17:10:05'),
  (89, 20, 'AB+', 'PACKED_RBC', 17, '2026-11-05 17:10:05')
ON DUPLICATE KEY UPDATE `units_available` = VALUES(`units_available`), `last_updated` = VALUES(`last_updated`);

INSERT INTO `blood_inventory` (`id`, `hub_id`, `blood_group`, `component`, `units_available`, `last_updated`) VALUES
  (90, 20, 'AB+', 'PLATELETS', 11, '2026-11-05 17:10:05'),
  (91, 20, 'AB+', 'PLASMA', 26, '2026-11-05 17:10:05'),
  (92, 20, 'O-', 'WHOLE_BLOOD', 11, '2026-11-05 17:10:05'),
  (93, 20, 'O-', 'PACKED_RBC', 14, '2026-11-05 17:10:05'),
  (94, 20, 'O-', 'PLATELETS', 8, '2026-11-05 17:10:05'),
  (95, 20, 'O-', 'PLASMA', 11, '2026-11-05 17:10:05'),
  (96, 20, 'A-', 'WHOLE_BLOOD', 8, '2026-11-05 17:10:05'),
  (97, 20, 'A-', 'PACKED_RBC', 11, '2026-11-05 17:10:05'),
  (98, 20, 'A-', 'PLATELETS', 6, '2026-11-05 17:10:05'),
  (99, 20, 'A-', 'PLASMA', 8, '2026-11-05 17:10:05'),
  (100, 20, 'B-', 'WHOLE_BLOOD', 7, '2026-11-05 17:10:05'),
  (101, 20, 'B-', 'PACKED_RBC', 9, '2026-11-05 17:10:05'),
  (102, 20, 'B-', 'PLATELETS', 5, '2026-11-05 17:10:05'),
  (103, 20, 'B-', 'PLASMA', 7, '2026-11-05 17:10:05'),
  (104, 20, 'AB-', 'WHOLE_BLOOD', 5, '2026-11-05 17:10:05'),
  (105, 20, 'AB-', 'PACKED_RBC', 6, '2026-11-05 17:10:05'),
  (106, 20, 'AB-', 'PLATELETS', 4, '2026-11-05 17:10:05'),
  (107, 20, 'AB-', 'PLASMA', 5, '2026-11-05 17:10:05'),
  (109, 28, 'O+', 'PACKED_RBC', 36, '2026-11-05 17:10:05'),
  (110, 28, 'O+', 'PLATELETS', 18, '2026-11-05 17:10:05'),
  (111, 28, 'O+', 'PLASMA', 24, '2026-11-05 17:10:05'),
  (112, 28, 'A+', 'WHOLE_BLOOD', 27, '2026-11-05 17:10:05'),
  (113, 28, 'A+', 'PACKED_RBC', 29, '2026-11-05 17:10:05'),
  (114, 28, 'A+', 'PLATELETS', 14, '2026-11-05 17:10:05'),
  (115, 28, 'A+', 'PLASMA', 20, '2026-11-05 17:10:05'),
  (116, 28, 'B+', 'WHOLE_BLOOD', 29, '2026-11-05 17:10:05'),
  (117, 28, 'B+', 'PACKED_RBC', 33, '2026-11-05 17:10:05'),
  (118, 28, 'B+', 'PLATELETS', 17, '2026-11-05 17:10:05'),
  (119, 28, 'B+', 'PLASMA', 21, '2026-11-05 17:10:05'),
  (120, 28, 'AB+', 'WHOLE_BLOOD', 14, '2026-11-05 17:10:05'),
  (121, 28, 'AB+', 'PACKED_RBC', 17, '2026-11-05 17:10:05'),
  (122, 28, 'AB+', 'PLATELETS', 11, '2026-11-05 17:10:05'),
  (123, 28, 'AB+', 'PLASMA', 26, '2026-11-05 17:10:05'),
  (124, 28, 'O-', 'WHOLE_BLOOD', 11, '2026-11-05 17:10:05'),
  (125, 28, 'O-', 'PACKED_RBC', 14, '2026-11-05 17:10:05'),
  (126, 28, 'O-', 'PLATELETS', 8, '2026-11-05 17:10:05'),
  (127, 28, 'O-', 'PLASMA', 11, '2026-11-05 17:10:05'),
  (128, 28, 'A-', 'WHOLE_BLOOD', 8, '2026-11-05 17:10:05'),
  (129, 28, 'A-', 'PACKED_RBC', 11, '2026-11-05 17:10:05'),
  (130, 28, 'A-', 'PLATELETS', 6, '2026-11-05 17:10:05'),
  (131, 28, 'A-', 'PLASMA', 8, '2026-11-05 17:10:05'),
  (132, 28, 'B-', 'WHOLE_BLOOD', 7, '2026-11-05 17:10:05'),
  (133, 28, 'B-', 'PACKED_RBC', 9, '2026-11-05 17:10:05'),
  (134, 28, 'B-', 'PLATELETS', 5, '2026-11-05 17:10:05'),
  (135, 28, 'B-', 'PLASMA', 7, '2026-11-05 17:10:05'),
  (136, 28, 'AB-', 'WHOLE_BLOOD', 5, '2026-11-05 17:10:05'),
  (137, 28, 'AB-', 'PACKED_RBC', 6, '2026-11-05 17:10:05'),
  (138, 28, 'AB-', 'PLATELETS', 4, '2026-11-05 17:10:05'),
  (139, 28, 'AB-', 'PLASMA', 5, '2026-11-05 17:10:05'),
  (140, 29, 'O+', 'WHOLE_BLOOD', 32, '2026-11-05 17:10:05')
ON DUPLICATE KEY UPDATE `units_available` = VALUES(`units_available`), `last_updated` = VALUES(`last_updated`);

INSERT INTO `blood_inventory` (`id`, `hub_id`, `blood_group`, `component`, `units_available`, `last_updated`) VALUES
  (141, 29, 'O+', 'PACKED_RBC', 36, '2026-11-05 17:10:05'),
  (142, 29, 'O+', 'PLATELETS', 18, '2026-11-05 17:10:05'),
  (143, 29, 'O+', 'PLASMA', 24, '2026-11-05 17:10:05'),
  (144, 29, 'A+', 'WHOLE_BLOOD', 27, '2026-11-05 17:10:05'),
  (145, 29, 'A+', 'PACKED_RBC', 29, '2026-11-05 17:10:05'),
  (146, 29, 'A+', 'PLATELETS', 14, '2026-11-05 17:10:05'),
  (147, 29, 'A+', 'PLASMA', 20, '2026-11-05 17:10:05'),
  (148, 29, 'B+', 'WHOLE_BLOOD', 29, '2026-11-05 17:10:05'),
  (149, 29, 'B+', 'PACKED_RBC', 33, '2026-11-05 17:10:05'),
  (150, 29, 'B+', 'PLATELETS', 17, '2026-11-05 17:10:05'),
  (151, 29, 'B+', 'PLASMA', 21, '2026-11-05 17:10:05'),
  (152, 29, 'AB+', 'WHOLE_BLOOD', 14, '2026-11-05 17:10:05'),
  (153, 29, 'AB+', 'PACKED_RBC', 17, '2026-11-05 17:10:05'),
  (154, 29, 'AB+', 'PLATELETS', 11, '2026-11-05 17:10:05'),
  (155, 29, 'AB+', 'PLASMA', 26, '2026-11-05 17:10:05'),
  (156, 29, 'O-', 'WHOLE_BLOOD', 11, '2026-11-05 17:10:05'),
  (157, 29, 'O-', 'PACKED_RBC', 14, '2026-11-05 17:10:05'),
  (158, 29, 'O-', 'PLATELETS', 8, '2026-11-05 17:10:05'),
  (159, 29, 'O-', 'PLASMA', 11, '2026-11-05 17:10:05'),
  (160, 29, 'A-', 'WHOLE_BLOOD', 8, '2026-11-05 17:10:05'),
  (161, 29, 'A-', 'PACKED_RBC', 11, '2026-11-05 17:10:05'),
  (162, 29, 'A-', 'PLATELETS', 6, '2026-11-05 17:10:05'),
  (163, 29, 'A-', 'PLASMA', 8, '2026-11-05 17:10:05'),
  (164, 29, 'B-', 'WHOLE_BLOOD', 7, '2026-11-05 17:10:05'),
  (165, 29, 'B-', 'PACKED_RBC', 9, '2026-11-05 17:10:05'),
  (166, 29, 'B-', 'PLATELETS', 5, '2026-11-05 17:10:05'),
  (167, 29, 'B-', 'PLASMA', 7, '2026-11-05 17:10:05'),
  (168, 29, 'AB-', 'WHOLE_BLOOD', 5, '2026-11-05 17:10:05'),
  (169, 29, 'AB-', 'PACKED_RBC', 6, '2026-11-05 17:10:05'),
  (170, 29, 'AB-', 'PLATELETS', 4, '2026-11-05 17:10:05'),
  (171, 29, 'AB-', 'PLASMA', 5, '2026-11-05 17:10:05')
ON DUPLICATE KEY UPDATE `units_available` = VALUES(`units_available`), `last_updated` = VALUES(`last_updated`);

-- --------------------------------------------------------------------
-- DATA FOR TABLE: available_organs (33 rows)
-- --------------------------------------------------------------------
INSERT INTO `available_organs` (`id`, `organ_type_id`, `donor_user_id`, `harvesting_hub_id`, `current_hub_id`, `blood_group`, `harvested_at`, `expires_at`, `status`, `clinical_notes`, `created_at`) VALUES
  (5, 4, NULL, 9, 9, 'O-', '2026-10-24 10:31:21', '2026-10-25 22:31:21', 'MATCHING', 'Deceased Donor Kidney', '2026-10-24 11:01:20'),
  (15, 1, NULL, 28, 28, 'O+', '2026-10-25 06:26:00', '2026-10-25 12:26:00', 'TRANSPLANTED', 'Donor Cardiac Graft - Perfused with Custodiol HTK solution. Warm ischemia time: 14 mins.
[2026-10-25T06:56:00.432Z] Matched to patient ID #482. Surgical team mobilized.
[2026-10-25T06:56:00.440Z] Packed in cold preservation container. Dispatched via Green Corridor ambulance.
[2026-10-25T06:56:00.449Z] Arrived at destination OT. Perfusion verified intact.
[2026-10-25T06:56:00.457Z] Anastomosis successful. Graft re-perfused. Patient stable.', '2026-10-25 06:56:00'),
  (16, 1, NULL, 28, 28, 'AB+', '2026-10-24 23:56:00', '2026-10-25 05:56:00', 'EXPIRED', 'Cardiac Graft - Procurement audit record', '2026-10-25 06:56:00'),
  (17, 3, NULL, 29, 29, 'A+', '2026-10-25 06:11:04', '2026-10-25 18:11:04', 'ALLOCATED', 'Orthotopic Donor Liver - Biopsy steatosis < 5%.', '2026-10-25 06:56:03'),
  (56, 4, NULL, 9, 9, 'O+', '2026-10-28 11:13:38', '2099-12-31 18:29:59', 'ALLOCATED', 'High-viability deceased donor kidney. Pulsatile hypothermic perfusion preserved. Zero warm ischemia.', '2026-10-28 12:13:38'),
  (57, 4, NULL, 20, 20, 'A+', '2026-10-28 11:13:38', '2099-12-31 18:29:59', 'AVAILABLE', 'Donor kidney (A+). Cold ischemia bypassed for clinical algorithm verification. HLA typing: A*02, B*44.', '2026-10-28 12:13:38'),
  (58, 4, NULL, 29, 29, 'B+', '2026-10-28 11:13:38', '2099-12-31 18:29:59', 'ALLOCATED', 'Donor kidney (B+). Cold perfused with University of Wisconsin (UW) preservation solution.', '2026-10-28 12:13:38'),
  (59, 4, NULL, 30, 30, 'AB-', '2026-10-28 11:13:38', '2099-12-31 18:29:59', 'AVAILABLE', 'Rare Rh-negative donor kidney (AB-). Baseline biopsy shows normal glomeruli.', '2026-10-28 12:13:38'),
  (60, 3, NULL, 9, 9, 'O+', '2026-10-28 11:13:38', '2099-12-31 18:29:59', 'AVAILABLE', 'Full-size orthotopic liver graft (O+). Perfused with Custodiol HTK. Optimal vascular anatomy.', '2026-10-28 12:13:38'),
  (61, 3, NULL, 20, 20, 'B+', '2026-10-28 11:13:38', '2099-12-31 18:29:59', 'AVAILABLE', 'Split liver graft (B+). Macrosteatosis < 5%. Ready for recipient crossmatch.', '2026-10-28 12:13:38'),
  (62, 1, NULL, 9, 9, 'O+', '2026-10-28 11:13:38', '2099-12-31 18:29:59', 'ALLOCATED', 'Donor heart (O+). Left ventricular ejection fraction > 65%. Continuous micro-perfusion simulated.', '2026-10-28 12:13:38'),
  (63, 1, NULL, 29, 29, 'A-', '2026-10-28 11:13:38', '2099-12-31 18:29:59', 'AVAILABLE', 'Adult cardiac graft (A-). Preserved under hypothermic machine perfusion.', '2026-10-28 12:13:38'),
  (64, 2, NULL, 20, 20, 'A+', '2026-10-28 11:13:38', '2099-12-31 18:29:59', 'AVAILABLE', 'Bilateral lung block (A+). Ex-vivo lung perfusion (EVLP) verified with normal compliance.', '2026-10-28 12:13:38'),
  (65, 2, NULL, 9, 9, 'O-', '2026-10-28 11:13:38', '2099-12-31 18:29:59', 'AVAILABLE', 'Universal donor bilateral lungs (O-). PaO2/FiO2 ratio > 450 mmHg.', '2026-10-28 12:13:38'),
  (66, 6, NULL, 9, 9, 'B+', '2026-10-28 11:13:38', '2099-12-31 18:29:59', 'AVAILABLE', 'Clear cornea tissue in Optisol-GS medium. Endothelial cell density > 2900 cells/mm².', '2026-10-28 12:13:38'),
  (67, 5, NULL, 30, 30, 'O+', '2026-10-28 11:13:38', '2099-12-31 18:29:59', 'AVAILABLE', 'Whole pancreas allograft with intact duodenal C-loop. Cold ischemia simulated permanent.', '2026-10-28 12:13:38'),
  (102, 4, NULL, 27, 27, 'O+', '2026-11-05 15:10:05', '2099-12-31 18:29:59', 'AVAILABLE', 'Donor Age 28. Pulsatile hypothermic machine perfusion (LifePort). Zero warm ischemia time. Glomerulosclerosis < 2%, flow 135 mL/min, resistance 0.16 mmHg/mL/min. HLA typing: A*02, A*24, B*07, B*44, DRB1*04. [NEVER EXPIRES]', '2026-11-05 17:10:05'),
  (103, 4, NULL, 27, 27, 'A+', '2026-11-05 15:10:05', '2099-12-31 18:29:59', 'AVAILABLE', 'Donor Age 34. Cold perfusion with University of Wisconsin (UW) solution. Serum creatinine at harvest 0.8 mg/dL. Single renal artery and vein with aortic patch. HLA typing: A*01, A*03, B*08, B*35, DRB1*03. [NEVER EXPIRES]', '2026-11-05 17:10:05'),
  (104, 4, NULL, 27, 27, 'B+', '2026-11-05 15:10:05', '2099-12-31 18:29:59', 'AVAILABLE', 'Donor Age 25. Dual-perfused graft with HTK Custodiol solution. Dual renal arteries on single aortic Carrel patch. Biopsy confirms normal glomeruli and interstitial architecture. [NEVER EXPIRES]', '2026-11-05 17:10:05'),
  (105, 4, NULL, 27, 27, 'AB-', '2026-11-05 15:10:05', '2099-12-31 18:29:59', 'AVAILABLE', 'Donor Age 30. Rare Rh-negative deceased donor kidney. High viability indices, resistance index 0.18 mmHg/mL/min, perfusate flow 128 mL/min. Crossmatch ready. [NEVER EXPIRES]', '2026-11-05 17:10:05'),
  (106, 4, NULL, 27, 27, 'O-', '2026-11-05 15:10:05', '2099-12-31 18:29:59', 'AVAILABLE', 'Donor Age 22. Universal donor kidney graft. Machine hypothermic perfused, perfusate flow > 140 mL/min. Normal anatomical margins. [NEVER EXPIRES]', '2026-11-05 17:10:05'),
  (107, 3, NULL, 27, 27, 'O+', '2026-11-05 15:10:05', '2099-12-31 18:29:59', 'AVAILABLE', 'Donor Age 29. Full-size orthotopic liver graft. Perfused with Custodiol HTK. Optimal vascular anatomy, macrosteatosis < 3%, normal intrahepatic bile ducts. [NEVER EXPIRES]', '2026-11-05 17:10:05'),
  (108, 3, NULL, 27, 27, 'A+', '2026-11-05 15:10:05', '2099-12-31 18:29:59', 'AVAILABLE', 'Donor Age 32. Right lobe donor graft (Segments V-VIII). Graft-to-recipient weight ratio (GRWR) 1.18%. Flushed with UW cold storage solution. Normal portal flow dynamics. [NEVER EXPIRES]', '2026-11-05 17:10:05'),
  (109, 3, NULL, 27, 27, 'B+', '2026-11-05 15:10:05', '2099-12-31 18:29:59', 'AVAILABLE', 'Donor Age 26. Whole deceased donor liver graft. Biopsy confirmed macrosteatosis < 5%. Excellent parenchymal preservation, rapid bile clearance. [NEVER EXPIRES]', '2026-11-05 17:10:05'),
  (110, 1, NULL, 27, 27, 'O+', '2026-11-05 15:10:05', '2099-12-31 18:29:59', 'AVAILABLE', 'Donor Age 24. Cardiac graft preserved with continuous micro-perfusion (TransMedics OCS Heart). Left ventricular ejection fraction (LVEF) 65%. Zero coronary calcification. [NEVER EXPIRES]', '2026-11-05 17:10:05'),
  (111, 1, NULL, 27, 27, 'A-', '2026-11-05 15:10:05', '2099-12-31 18:29:59', 'AVAILABLE', 'Donor Age 27. Adult cardiac graft. Preserved under hypothermic machine perfusion. PaO2 > 450 mmHg, normal wall motion by transesophageal echocardiography. [NEVER EXPIRES]', '2026-11-05 17:10:05'),
  (112, 1, NULL, 27, 27, 'B+', '2026-11-05 15:10:05', '2099-12-31 18:29:59', 'AVAILABLE', 'Donor Age 31. Cardiac allograft preserved with St. Thomas cold cardioplegia solution. Normal donor ECG, zero ischemic changes. [NEVER EXPIRES]', '2026-11-05 17:10:05'),
  (113, 2, NULL, 27, 27, 'O-', '2026-11-05 15:10:05', '2099-12-31 18:29:59', 'AVAILABLE', 'Donor Age 23. Universal donor bilateral lung block. Ex-vivo lung perfusion (EVLP) verified with static lung compliance 55 mL/cmH2O. PaO2/FiO2 ratio > 480 mmHg. [NEVER EXPIRES]', '2026-11-05 17:10:05'),
  (114, 2, NULL, 27, 27, 'A+', '2026-11-05 15:10:05', '2099-12-31 18:29:59', 'AVAILABLE', 'Donor Age 29. Single left lung allograft. Clear bronchoscopy negative for aspiration, PaO2/FiO2 > 430 mmHg on 100% FiO2. EVLP stabilized. [NEVER EXPIRES]', '2026-11-05 17:10:05'),
  (115, 5, NULL, 27, 27, 'O+', '2026-11-05 15:10:05', '2099-12-31 18:29:59', 'AVAILABLE', 'Donor Age 21. Whole pancreas allograft with intact duodenal C-loop and mesenteric vascular reconstruction. Cold ischemia preserved in UW solution. [NEVER EXPIRES]', '2026-11-05 17:10:05'),
  (116, 6, NULL, 27, 27, 'B+', '2026-11-05 15:10:05', '2099-12-31 18:29:59', 'AVAILABLE', 'Donor Age 35. Optical-grade corneal graft preserved in Optisol-GS medium at 4°C. Endothelial cell density (ECD) 3,100 cells/mm². Crystal clear stroma. [NEVER EXPIRES]', '2026-11-05 17:10:05'),
  (117, 6, NULL, 27, 27, 'O+', '2026-11-05 15:10:05', '2099-12-31 18:29:59', 'AVAILABLE', 'Donor Age 27. Penetrating keratoplasty tissue in corneal storage medium. ECD 3,250 cells/mm², epithelial integrity 100%. Negative for infectious markers. [NEVER EXPIRES]', '2026-11-05 17:10:05'),
  (118, 4, '56c4338a-a957-4b0c-9255-4d51276862ed', 27, 27, 'A+', '2026-06-20 02:30:00', '2026-06-21 14:30:00', 'TRANSPLANTED', 'Living humanitarian renal allograft donation by Satyanarayana Chittidi. Zero warm ischemia time. Successfully transplanted into recipient with immediate diuresis.', '2026-11-05 17:17:23')
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`), `expires_at` = VALUES(`expires_at`), `clinical_notes` = VALUES(`clinical_notes`);

-- --------------------------------------------------------------------
-- DATA FOR TABLE: transplant_requests (26 rows)
-- --------------------------------------------------------------------
INSERT INTO `transplant_requests` (`id`, `recipient_user_id`, `attending_hub_id`, `organ_type_id`, `blood_group`, `urgency_tier`, `medical_summary`, `status`, `verified_at`, `created_at`) VALUES
  (4, '9c91d959-3900-4575-8fba-1ff550132993', 9, 4, 'O-', 'TIER_1_EMERGENCY', 'Chronic kidney disease stage 5 on maintenance hemodialysis.', 'WAITING_LIST', '2026-10-24 11:01:20', '2026-10-24 11:01:20'),
  (14, '442ec46a-0f73-40b9-8966-88d118e8ae7a', 30, 3, 'A+', 'TIER_1_EMERGENCY', 'Acute hepatic failure on mechanical ventilation.', 'WAITING_LIST', '2026-10-25 06:56:03', '2026-10-25 06:56:03'),
  (15, 'b10b79af-d32e-495e-bd3a-4c563a348db0', 30, 3, 'A+', 'TIER_2_URGENT', 'Decompensated cirrhosis with recurrent ascites.', 'ACCEPTED', '2026-10-25 06:56:03', '2026-10-25 06:56:03'),
  (16, 'd34f2924-4cb8-4671-af54-70cf03f6c351', 30, 3, 'A+', 'TIER_3_ROUTINE', 'Stable NASH cirrhosis.', 'WAITING_LIST', '2026-10-25 06:56:03', '2026-10-25 06:56:03'),
  (34, '810c59cf-da16-495c-afdb-c6e154d6777c', 27, 4, 'B+', 'TIER_2_URGENT', 'abcd', 'WAITING_LIST', '2026-10-28 10:14:10', '2026-10-28 10:14:10'),
  (35, '810c59cf-da16-495c-afdb-c6e154d6777c', 27, 4, 'B+', 'TIER_2_URGENT', '112345', 'WAITING_LIST', '2026-10-28 10:28:30', '2026-10-28 10:28:30'),
  (36, '810c59cf-da16-495c-afdb-c6e154d6777c', 27, 3, 'B+', 'TIER_2_URGENT', '12345678', 'ACCEPTED', '2026-10-28 10:29:45', '2026-10-28 10:29:45'),
  (71, 'b3e9d07a-47be-4b4d-9c18-1a350789f3a5', 9, 4, 'O+', 'TIER_1_EMERGENCY', 'End-stage renal disease (ESRD) with failed vascular access for hemodialysis. Recurrent refractory hyperkalemia. UNOS Tier 1 Emergency indication.', 'WAITING_LIST', '2026-10-28 12:13:38', '2026-04-01 12:13:38'),
  (72, 'e51d13db-31ab-4778-8c97-d07b951e811e', 9, 4, 'O+', 'TIER_2_URGENT', 'Chronic glomerulonephritis on continuous ambulatory peritoneal dialysis (CAPD) with recurrent peritonitis episodes.', 'WAITING_LIST', '2026-10-28 12:13:38', '2026-07-30 12:13:38'),
  (73, '8406c313-d12d-4552-a1c8-9a36ff4cf8f4', 20, 4, 'A+', 'TIER_1_EMERGENCY', 'Rapidly progressive crescentic glomerulonephritis with acute uremic encephalopathy requiring urgent deceased donor renal transplant.', 'ACCEPTED', '2026-10-28 12:13:38', '2026-10-13 12:13:38'),
  (74, '25099de0-538e-4920-ad88-aa76c83aac75', 29, 4, 'B+', 'TIER_2_URGENT', 'Autosomal dominant polycystic kidney disease (ADPKD) with nephromegaly and refractory severe renal anemia.', 'ACCEPTED', '2026-10-28 12:13:38', '2025-12-12 12:13:38'),
  (75, '1d8e07d7-6420-49ed-a07e-d14db4dc9081', 30, 4, 'AB+', 'TIER_3_ROUTINE', 'Diabetic nephropathy secondary to long-standing T2D. Stable on maintenance hemodialysis 3x/week. Universal recipient (AB+).', 'WAITING_LIST', '2026-10-28 12:13:38', '2026-09-13 12:13:38'),
  (76, '4674df15-aa24-44ca-90e1-951f22c3a115', 20, 4, 'O-', 'TIER_3_ROUTINE', 'Reflux nephropathy with bilateral small contracted kidneys. Patient maintains stable dry weight on nocturnal home dialysis.', 'WAITING_LIST', '2026-10-28 12:13:38', '2026-05-01 12:13:38'),
  (77, '93d75861-57ed-4780-9197-f852625a37e5', 9, 3, 'O+', 'TIER_1_EMERGENCY', 'Fulminant acute hepatic failure secondary to drug-induced liver injury (DILI). Grade 3 hepatic encephalopathy. MELD score: 39.', 'WAITING_LIST', '2026-10-28 12:13:38', '2026-10-18 12:13:38'),
  (78, '2e969834-dbfa-42c8-b83a-763d27ed758c', 20, 3, 'B+', 'TIER_1_EMERGENCY', 'Decompensated cirrhosis with type 1 hepatorenal syndrome and recurrent variceal bleeds. MELD score: 34.', 'WAITING_LIST', '2026-10-28 12:13:38', '2026-08-29 12:13:38'),
  (79, '5bf3c5d0-6259-4c65-b36c-c4a3bf2afbcf', 29, 3, 'A+', 'TIER_2_URGENT', 'Cryptogenic cirrhosis with refractory diuretic-resistant ascites and spontaneous bacterial peritonitis. MELD score: 26.', 'WAITING_LIST', '2026-10-28 12:13:38', '2026-07-10 12:13:38'),
  (80, '99882cf2-0b05-4953-ae07-68c2ee10aa40', 9, 1, 'O+', 'TIER_1_EMERGENCY', 'Ischemic cardiomyopathy NYHA Class IV on dual inotrope support (milrinone + noradrenaline) in cardiac ICU. Status 1A candidate.', 'ACCEPTED', '2026-10-28 12:13:38', '2026-10-03 12:13:38'),
  (81, '53a41ccb-aea7-407a-8f83-0a38e8d70885', 29, 1, 'A-', 'TIER_1_EMERGENCY', 'Dilated cardiomyopathy with LVAD driveline bacteremia and severe right ventricular failure. UNOS Status 1A.', 'WAITING_LIST', '2026-10-28 12:13:38', '2026-09-18 12:13:38'),
  (82, '207063e9-795a-400a-b359-d35368699540', 20, 1, 'O+', 'TIER_2_URGENT', 'Post-viral myocarditis with LVEF 18%, recurrent non-sustained ventricular tachycardias on automatic implantable cardioverter-defibrillator.', 'WAITING_LIST', '2026-10-28 12:13:38', '2026-07-25 12:13:38'),
  (83, '859e14af-d954-4f08-b9d0-5abc9625be26', 20, 2, 'A+', 'TIER_1_EMERGENCY', 'Idiopathic pulmonary fibrosis (IPF) with acute exacerbation on veno-venous ECMO bridge. High urgent bilateral lung priority.', 'WAITING_LIST', '2026-10-28 12:13:38', '2026-09-28 12:13:38'),
  (84, '9363da13-b82c-4205-ba3e-06ff5993784a', 9, 2, 'O-', 'TIER_2_URGENT', 'Cystic fibrosis with end-stage bronchiectasis, recurrent Pseudomonas respiratory failure, FEV1 22% of predicted.', 'WAITING_LIST', '2026-10-28 12:13:38', '2026-06-10 12:13:38'),
  (85, '952c2dad-dcdc-4440-9fe4-5415222e98b2', 9, 6, 'B+', 'TIER_2_URGENT', 'Severe bilateral corneal stromal dystrophy with central optical scarring. Visual acuity reduced to hand motion.', 'WAITING_LIST', '2026-10-28 12:13:38', '2026-08-14 12:13:38'),
  (86, 'c7a1794e-ee67-4883-829b-182a2e4e42bd', 29, 6, 'O+', 'TIER_3_ROUTINE', 'Pseudophakic bullous keratopathy with corneal decompensation following complicated cataract extraction.', 'WAITING_LIST', '2026-10-28 12:13:38', '2026-04-11 12:13:38'),
  (87, '003740d6-8857-40b3-b3af-0fd43f125a4b', 30, 5, 'O+', 'TIER_2_URGENT', 'Type 1 diabetes mellitus with severe hypoglycemic unawareness and frequent life-threatening neuroglycopenic seizures.', 'WAITING_LIST', '2026-10-28 12:13:38', '2026-08-09 12:13:38'),
  (88, '810c59cf-da16-495c-afdb-c6e154d6777c', 27, 6, 'B+', 'TIER_1_EMERGENCY', '12345', 'WAITING_LIST', '2026-10-29 16:49:21', '2026-10-29 16:49:21'),
  (89, '56c4338a-a957-4b0c-9255-4d51276862ed', 27, 6, 'A+', 'TIER_3_ROUTINE', 'Optical penetrating keratoplasty for traumatic corneal opacity. Successful corneal transplant performed with 6/9 post-op visual acuity.', 'FULFILLED', '2026-03-10 05:30:00', '2026-02-15 04:00:00')
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`), `medical_summary` = VALUES(`medical_summary`), `urgency_tier` = VALUES(`urgency_tier`);

-- --------------------------------------------------------------------
-- DATA FOR TABLE: blood_requests (23 rows)
-- --------------------------------------------------------------------
INSERT INTO `blood_requests` (`id`, `requester_user_id`, `destination_hub_id`, `target_hub_id`, `fulfilling_hub_id`, `donor_user_id`, `blood_group`, `component`, `units_requested`, `urgency`, `status`, `delivery_address`, `created_at`, `fulfilled_at`, `patient_relationship`, `patient_name`, `hospital_bed_no`) VALUES
  (1, '810c59cf-da16-495c-afdb-c6e154d6777c', 20, NULL, NULL, NULL, 'O-', 'PACKED_RBC', 2, 'CRITICAL', 'CANCELLED', 'All India Institute of Medical Sciences (AIIMS)', '2026-10-26 06:21:33', NULL, 'SELF', NULL, NULL),
  (2, '810c59cf-da16-495c-afdb-c6e154d6777c', 20, NULL, NULL, NULL, 'O-', 'PACKED_RBC', 2, 'CRITICAL', 'CANCELLED', 'All India Institute of Medical Sciences (AIIMS)', '2026-10-26 06:28:43', NULL, 'SELF', NULL, NULL),
  (3, '810c59cf-da16-495c-afdb-c6e154d6777c', 20, NULL, NULL, NULL, 'A+', 'PACKED_RBC', 2, 'CRITICAL', 'CANCELLED', 'All India Institute of Medical Sciences (AIIMS)', '2026-10-26 06:29:10', NULL, 'SELF', NULL, NULL),
  (4, '810c59cf-da16-495c-afdb-c6e154d6777c', 20, NULL, NULL, NULL, 'B+', 'PACKED_RBC', 2, 'CRITICAL', 'CANCELLED', 'All India Institute of Medical Sciences (AIIMS)', '2026-10-26 06:29:19', NULL, 'SELF', NULL, NULL),
  (5, '32d3e06c-4d0d-4390-919a-ea596bac1aab', 20, NULL, NULL, NULL, 'B+', 'PACKED_RBC', 2, 'CRITICAL', 'CANCELLED', 'All India Institute of Medical Sciences (AIIMS)', '2026-10-26 06:30:01', NULL, 'SELF', NULL, NULL),
  (6, '32d3e06c-4d0d-4390-919a-ea596bac1aab', 27, NULL, NULL, NULL, 'A+', 'PACKED_RBC', 2, 'CRITICAL', 'CANCELLED', 'City Trauma Emergency Hospital', '2026-10-26 06:30:10', NULL, 'SELF', NULL, NULL),
  (7, '810c59cf-da16-495c-afdb-c6e154d6777c', 28, NULL, NULL, NULL, 'A+', 'PACKED_RBC', 2, 'CRITICAL', 'CANCELLED', 'Apollo Multi-Specialty Transplant Center', '2026-10-26 06:39:12', NULL, 'SELF', NULL, NULL),
  (8, '810c59cf-da16-495c-afdb-c6e154d6777c', 20, NULL, NULL, NULL, 'A+', 'PACKED_RBC', 2, 'CRITICAL', 'CANCELLED', 'All India Institute of Medical Sciences (AIIMS)', '2026-10-26 06:51:06', NULL, 'SELF', NULL, NULL),
  (13, '32d3e06c-4d0d-4390-919a-ea596bac1aab', 20, NULL, NULL, NULL, 'B+', 'PACKED_RBC', 2, 'CRITICAL', 'CANCELLED', 'All India Institute of Medical Sciences (AIIMS)', '2026-10-26 07:20:23', NULL, 'SELF', NULL, NULL),
  (14, '32d3e06c-4d0d-4390-919a-ea596bac1aab', 20, NULL, NULL, NULL, 'B+', 'PACKED_RBC', 2, 'CRITICAL', 'CANCELLED', 'All India Institute of Medical Sciences (AIIMS)', '2026-10-26 08:10:31', NULL, 'SELF', NULL, NULL),
  (15, '810c59cf-da16-495c-afdb-c6e154d6777c', 28, NULL, NULL, NULL, 'O-', 'PACKED_RBC', 2, 'CRITICAL', 'CANCELLED', 'Apollo Multi-Specialty Transplant Center', '2026-10-26 08:31:45', NULL, 'OTHER', 'Budda Gadu', NULL),
  (16, '598ff7e2-9b50-4fc3-949a-e4d2d76cc66d', 26, NULL, NULL, NULL, 'AB+', 'WHOLE_BLOOD', 5, 'CRITICAL', 'CANCELLED', 'Red Cross Central Blood Bank', '2026-10-26 14:09:03', NULL, 'SELF', 'bhaaaaai', NULL),
  (17, '810c59cf-da16-495c-afdb-c6e154d6777c', 29, NULL, NULL, NULL, 'AB+', 'WHOLE_BLOOD', 5, 'CRITICAL', 'CANCELLED', 'KEM Hospital Mumbai', '2026-10-26 14:16:08', NULL, 'OTHER', 'Budda Jaatu', NULL),
  (18, '84f0b314-c0a0-46fc-9760-70c8c3cfb39e', 9, 9, 9, '8de4586b-7736-4b47-871b-5008aaac41c1', 'O+', 'PACKED_RBC', 2, 'ROUTINE', 'COMPLETED', NULL, '2026-10-28 18:01:29', '2026-10-28 18:01:29', 'VOLUNTARY_DONATION', 'Chittidi Satyanarayana', NULL),
  (19, '9c91d959-3900-4575-8fba-1ff550132993', 9, 9, 9, NULL, 'O+', 'PACKED_RBC', 1, 'URGENT', 'COMPLETED', NULL, '2026-10-28 18:01:29', '2026-10-28 18:01:29', 'HOSPITAL_DISPENSE', 'Rohan Kumar', 'ICU-Bed 02'),
  (20, '56c4338a-a957-4b0c-9255-4d51276862ed', 27, NULL, NULL, NULL, 'A+', 'PACKED_RBC', 2, 'URGENT', 'REQUESTED', 'City Trauma Emergency Hospital, 2nd Floor ICU', '2026-11-05 16:32:23', NULL, 'MOTHER', 'Lakshmi Chittidi', 'ICU-Bed-04'),
  (21, '56c4338a-a957-4b0c-9255-4d51276862ed', 34, NULL, NULL, 'dd680639-26d0-42c2-a810-c94655f0dd01', 'A+', 'PLATELETS', 1, 'CRITICAL', 'DONOR_COMMITTED', 'Continental Hospitals, Financial District, Nanakramguda', '2026-11-05 15:17:23', NULL, 'FATHER', 'Srinivas Chittidi', 'CCU-Bed-12'),
  (22, 'dd680639-26d0-42c2-a810-c94655f0dd01', 27, NULL, NULL, NULL, 'A+', 'PACKED_RBC', 2, 'CRITICAL', 'REQUESTED', 'City Trauma Emergency Hospital, Emergency Trauma Ward', '2026-11-05 16:47:23', NULL, 'FATHER', 'Ramesh Sharma', 'Trauma-Bed-07'),
  (23, '56305174-4bd5-4ffe-838a-ff64d26d31e1', 34, NULL, NULL, NULL, 'AB+', 'WHOLE_BLOOD', 3, 'URGENT', 'REQUESTED', 'Continental Hospitals, Nanakramguda, Hyderabad', '2026-11-05 15:47:23', NULL, 'SELF', 'Kavita Reddy', 'Oncology-DayCare-14'),
  (24, '3f079d05-fcc8-411a-ba6e-9004526a2f21', 32, NULL, NULL, NULL, 'A+', 'PLATELETS', 2, 'CRITICAL', 'REQUESTED', 'Nizam\'s Institute of Medical Sciences (NIMS), Punjagutta', '2026-11-05 14:17:23', NULL, 'SON', 'Aarav Verma', 'Pediatric-ICU-03'),
  (25, 'e9b68148-f104-4a24-87f0-72b0e33a7869', 33, NULL, NULL, NULL, 'B+', 'PACKED_RBC', 2, 'CRITICAL', 'REQUESTED', 'Yashoda Hospitals Somajiguda, Raj Bhavan Rd', '2026-11-05 16:17:23', NULL, 'BROTHER', 'Suresh Rao', 'Cardio-Ward-09'),
  (26, 'ce0adc0b-290a-4e13-b118-7f24e7a5bd93', 27, NULL, 27, '56c4338a-a957-4b0c-9255-4d51276862ed', 'A+', 'WHOLE_BLOOD', 1, 'URGENT', 'COMPLETED', 'City Trauma Emergency Hospital, Gachibowli', '2026-08-15 04:00:00', '2026-08-15 06:15:00', 'SELF', 'Amit Deshmukh', 'Ward-3B-Bed-21'),
  (27, '56c4338a-a957-4b0c-9255-4d51276862ed', 27, NULL, 27, '3f079d05-fcc8-411a-ba6e-9004526a2f21', 'A+', 'PACKED_RBC', 1, 'ROUTINE', 'COMPLETED', 'City Trauma Emergency Hospital, Gachibowli', '2026-05-12 08:30:00', '2026-05-12 11:00:00', 'SELF', 'Satyanarayana Chittidi', 'DayCare-Bed-02')
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`), `units_requested` = VALUES(`units_requested`), `urgency` = VALUES(`urgency`), `delivery_address` = VALUES(`delivery_address`);

-- --------------------------------------------------------------------
-- DATA FOR TABLE: blood_donation_camps (12 rows)
-- --------------------------------------------------------------------
INSERT INTO `blood_donation_camps` (`id`, `organizer_hub_id`, `created_by_user_id`, `camp_name`, `description`, `venue_name`, `address_line`, `city`, `state`, `pincode`, `camp_date`, `end_date`, `start_time`, `end_time`, `contact_phone`, `contact_email`, `target_units`, `status`, `latitude`, `longitude`, `map_url`, `created_at`, `updated_at`) VALUES
  (30, 27, '9a71417b-28fc-4a26-905c-1100f9265b81', 'HITEC City Cyber Towers Mega Blood Drive', 'Flagship corporate donation drive in partnership with cyber tech corridors. Includes on-site pre-donation health vitals screening, refreshments, and certified digital donor cards.', 'Cyber Towers Main Atrium, HITEC City', 'Hitech City Main Rd, Patrika Nagar, HITEC City', 'Hyderabad', 'Telangana', '500081', '2027-02-14 18:30:00', '2027-02-16 18:30:00', '09:00 AM', '06:00 PM', '+91 98490 12345', 'trauma.care@cityhospital.com', 300, 'UPCOMING', '17.45040000', '78.38080000', 'https://maps.google.com/?q=Cyber+Towers+Hyderabad', '2026-11-05 17:10:05', '2026-11-05 17:10:05'),
  (31, 27, '9a71417b-28fc-4a26-905c-1100f9265b81', 'Gachibowli Financial District Corporate LifeSaver Camp', 'Multi-corporate life-saving initiative hosting over 40 financial institutions and fintech firms. Fully air-conditioned mobile phlebotomy units available.', 'WaveRock SEZ Building 2 Concourse', 'WaveRock SEZ, Nanakramguda, Financial District', 'Hyderabad', 'Telangana', '500032', '2027-03-09 18:30:00', '2027-03-11 18:30:00', '09:30 AM', '05:30 PM', '+91 98490 12345', 'trauma.care@cityhospital.com', 250, 'UPCOMING', '17.41770000', '78.34440000', 'https://maps.google.com/?q=WaveRock+SEZ+Hyderabad', '2026-11-05 17:10:05', '2026-11-05 17:10:05'),
  (32, 20, 'e94a5470-4197-4a38-b1cb-80dc09e75d7f', 'AIIMS Capital LifeDrive & Stem Cell Camp', 'Premier central health institute donation camp. Complete screening for voluntary blood donation, HLA typing registry, and platelet apheresis counseling.', 'Jawahar Lal Nehru Auditorium Foyer, AIIMS', 'Sri Aurobindo Marg, Ansari Nagar East', 'New Delhi', 'Delhi', '110029', '2027-04-17 18:30:00', '2027-04-19 18:30:00', '08:30 AM', '05:30 PM', '+91 11 2658 8500', 'aiims.delhi@gov.in', 450, 'UPCOMING', '28.56720000', '77.21000000', 'https://maps.google.com/?q=AIIMS+New+Delhi', '2026-11-05 17:10:05', '2026-11-05 17:10:05'),
  (33, 44, '2f58b970-401f-4573-ac2a-8b3c00b7c7dd', 'Bengaluru Tech Corridor Heart & Blood Donation Festival', 'Organized in collaboration with electronic city tech giants. Dedicated to cardiac surgery patient reserves and emergency trauma stock.', 'Narayana Health City Central Lawn', '258/A, Bommasandra Industrial Area, Anekal Taluk', 'Bengaluru', 'Karnataka', '560099', '2027-05-14 18:30:00', '2027-05-16 18:30:00', '09:00 AM', '06:00 PM', '+91 80 7122 2222', 'transplant@narayanahealth.org', 350, 'UPCOMING', '12.80160000', '77.69740000', 'https://maps.google.com/?q=Narayana+Health+City+Bangalore', '2026-11-05 17:10:05', '2026-11-05 17:10:05'),
  (34, 40, '1d1e9c71-22ce-4539-8d99-b95098a6667e', 'Mumbai Oncology Support Platelet & Blood Drive', 'Critical blood and single-donor platelet (SDP) drive specifically supporting leukemia and solid tumor patients undergoing intensive chemotherapy.', 'R. D. Choksi Auditorium, Tata Memorial Hospital', 'Dr. E Borges Road, Parel East', 'Mumbai', 'Maharashtra', '400012', '2027-06-09 18:30:00', '2027-06-11 18:30:00', '09:00 AM', '05:00 PM', '+91 22 2417 7000', 'transplant.coord@tmc.gov.in', 320, 'UPCOMING', '19.00410000', '72.84320000', 'https://maps.google.com/?q=Tata+Memorial+Hospital+Mumbai', '2026-11-05 17:10:05', '2026-11-05 17:10:05'),
  (35, 48, 'c1b03fc3-00cf-46ce-827c-66ebf1b97075', 'Chennai Coastal Metro Community Blood Drive', 'Major metropolitan community blood drive supporting emergency cardiac and organ transplant surgeries across South India.', 'Express Avenue Mall Central Atrium, Royapettah', '21 Greams Lane, Off Greams Road, Thousand Lights', 'Chennai', 'Tamil Nadu', '600006', '2027-07-07 18:30:00', '2027-07-09 18:30:00', '10:00 AM', '07:00 PM', '+91 44 2829 0200', 'transplant.greams@apollohospitals.com', 280, 'UPCOMING', '13.05560000', '80.25200000', 'https://maps.google.com/?q=Apollo+Hospital+Greams+Road+Chennai', '2026-11-05 17:10:05', '2026-11-05 17:10:05'),
  (36, 30, '5ff051d2-7a55-490e-9997-b370be9bdd0b', 'Pune Silicon City Rotary Blood Camp', 'Annual industrial and IT park blood donation camp organized with Rotary Club of Pune. Free comprehensive hemoglobin and vital screening.', 'Magarpatta Cybercity Amphitheatre', 'Magarpatta, Hadapsar', 'Pune', 'Maharashtra', '411028', '2027-08-11 18:30:00', '2027-08-13 18:30:00', '09:00 AM', '05:00 PM', '+91 20 6681 9999', 'ruby.pune@hospital.org', 260, 'UPCOMING', '18.51670000', '73.92980000', 'https://maps.google.com/?q=Magarpatta+Cybercity+Pune', '2026-11-05 17:10:05', '2026-11-05 17:10:05'),
  (37, 53, '44e8f9f0-bd62-49aa-a8b2-9a6f67429fc0', 'Kolkata Metro East LifeSaver Blood Drive', 'Eastern India emergency blood drive bolstering reserves for pediatric surgery, accident trauma, and thalassemia transfusion recipients.', 'Science City Main Exhibition Pavilion', '127, Mukundapur, E.M. Bypass', 'Kolkata', 'West Bengal', '700099', '2027-09-04 18:30:00', '2027-09-06 18:30:00', '09:30 AM', '05:30 PM', '+91 33 6652 0000', 'transplant.desk@medicahospitals.in', 275, 'UPCOMING', '22.49880000', '88.39760000', 'https://maps.google.com/?q=Medica+Hospital+Kolkata', '2026-11-05 17:10:05', '2026-11-05 17:10:05'),
  (38, 56, '5c43676b-babf-47fd-94eb-f09e795ff14f', 'North India University Youth Blood Mission', 'Youth and student blood drive organizing tri-city university students. Equipped with state-of-the-art cold chain mobile storage vans.', 'Panjab University Student Centre Ground, Sector 14', 'Sector 12, Madhya Marg', 'Chandigarh', 'Chandigarh', '160012', '2027-10-01 18:30:00', '2027-10-03 18:30:00', '09:00 AM', '05:00 PM', '+91 172 274 7585', 'transplant@pgimer.edu.in', 350, 'UPCOMING', '30.76510000', '76.77660000', 'https://maps.google.com/?q=PGIMER+Chandigarh', '2026-11-05 17:10:05', '2026-11-05 17:10:05'),
  (39, 57, '4228dbae-b4b7-4eb4-a494-7c75b2ccf52e', 'Kerala Coastal Emergency Care Blood Drive', 'Coastal healthcare resilience drive dedicated to monsoon season emergency reserves and state-wide surgical readiness.', 'Lulu International Mall Grand Atrium, Edappally', 'AIMS Ponekkara P.O., Edappally', 'Kochi', 'Kerala', '682041', '2027-11-13 18:30:00', '2027-11-15 18:30:00', '10:00 AM', '07:00 PM', '+91 484 285 1234', 'organ.transplant@aims.amrita.edu', 230, 'UPCOMING', '10.03260000', '76.29990000', 'https://maps.google.com/?q=Amrita+Hospital+Kochi', '2026-11-05 17:10:05', '2026-11-05 17:10:05'),
  (40, 33, '83c98cb2-e082-4420-8e79-e2d1d7f94da0', 'Somajiguda Twin Cities Health & Blood Camp', 'Community wellness camp open to all local residents. Comprehensive blood group testing, hemoglobin assays, and organ donor pledge registration booth on site.', 'Nizam College Grounds, Basheerbagh', 'Raj Bhavan Road, Matha Nagar, Somajiguda', 'Hyderabad', 'Telangana', '500082', '2027-12-04 18:30:00', '2027-12-06 18:30:00', '08:30 AM', '04:30 PM', '+91 40 4567 4567', 'transplant.somajiguda@yashodahospitals.com', 200, 'UPCOMING', '17.42650000', '78.45780000', 'https://maps.google.com/?q=Yashoda+Hospital+Somajiguda', '2026-11-05 17:10:05', '2026-11-05 17:10:05'),
  (41, 55, 'fc4d1a0b-035d-4d27-9447-72d69914777f', 'Gujarat Industrial Corridor Lifeline Camp', 'Collaborative drive across Gujarat industrial corridors ensuring sufficient whole blood and plasma availability.', 'Ahmedabad Management Association (AMA) Complex', 'Zydus Hospital Road, SG Highway, Thaltej', 'Ahmedabad', 'Gujarat', '380054', '2028-01-17 18:30:00', '2028-01-19 18:30:00', '09:00 AM', '05:00 PM', '+91 79 6619 0201', 'transplant.care@zydushospitals.com', 260, 'UPCOMING', '23.07220000', '72.52550000', 'https://maps.google.com/?q=Zydus+Hospital+Ahmedabad', '2026-11-05 17:10:05', '2026-11-05 17:10:05')
ON DUPLICATE KEY UPDATE `camp_name` = VALUES(`camp_name`), `description` = VALUES(`description`), `venue_name` = VALUES(`venue_name`), `address_line` = VALUES(`address_line`), `city` = VALUES(`city`), `state` = VALUES(`state`), `pincode` = VALUES(`pincode`), `camp_date` = VALUES(`camp_date`), `end_date` = VALUES(`end_date`), `start_time` = VALUES(`start_time`), `end_time` = VALUES(`end_time`), `contact_phone` = VALUES(`contact_phone`), `contact_email` = VALUES(`contact_email`), `target_units` = VALUES(`target_units`), `status` = VALUES(`status`), `latitude` = VALUES(`latitude`), `longitude` = VALUES(`longitude`), `map_url` = VALUES(`map_url`);

