package com.deepscan.backend;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

@Entity
public class ScanResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String imageId;
    private String className;
    private double confidence;
    private double lat;
    private double lon;
    private boolean shadowCheckPassed;
    private String processedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getImageId() { return imageId; }
    public void setImageId(String imageId) { this.imageId = imageId; }

    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }

    public double getConfidence() { return confidence; }
    public void setConfidence(double confidence) { this.confidence = confidence; }

    public double getLat() { return lat; }
    public void setLat(double lat) { this.lat = lat; }

    public double getLon() { return lon; }
    public void setLon(double lon) { this.lon = lon; }

    public boolean isShadowCheckPassed() { return shadowCheckPassed; }
    public void setShadowCheckPassed(boolean shadowCheckPassed) { this.shadowCheckPassed = shadowCheckPassed; }

    public String getProcessedAt() { return processedAt; }
    public void setProcessedAt(String processedAt) { this.processedAt = processedAt; }
}