
CREATE DATABASE IF NOT EXISTS organ_donation_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE organ_donation_db;

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    role ENUM('USER', 'HOSPITAL', 'ADMIN') NOT NULL,
    auth_provider ENUM('LOCAL', 'GOOGLE') NOT NULL DEFAULT 'LOCAL',
    google_id VARCHAR(255) NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

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
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

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

CREATE TABLE IF NOT EXISTS organ_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code ENUM('HEART', 'KIDNEY', 'LIVER', 'LUNG', 'PANCREAS', 'CORNEA', 'BONE_MARROW', 'BLOOD') NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    category ENUM('SOLID_ORGAN', 'TISSUE', 'CELL_FLUID') NOT NULL,
    max_viability_hours INT NOT NULL,
    allow_living_donor BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB;

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
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organizer_hub_id) REFERENCES medical_hubs(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_camp_status_date (status, camp_date)
) ENGINE=InnoDB;
