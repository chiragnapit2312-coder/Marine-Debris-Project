package com.deepscan.backend;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ScanResultRepository extends JpaRepository<ScanResult, Long> {
    // Ye interface hai, khud kuch nahi likhna
    // JpaRepository already save(), findAll(), findById() jaisi methods deta hai
}