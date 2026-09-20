package com.deepscan.backend;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

@RestController
@CrossOrigin(origins = "*")
public class DetectController {

    @Autowired
    private ScanResultRepository scanResultRepository;

    // Dost ka Python AI model service (FastAPI) yahan chal raha hai
    private final String PYTHON_MODEL_URL = "https://marine-debris-ml.onrender.com/detect";

    // Base GPS point - real deployment mein ye sonar nav/ping-header file se aayega
    private final double BASE_LAT = 11.0168;
    private final double BASE_LON = 76.9558;

    @SuppressWarnings("unchecked")
    @PostMapping("/detect")
    public Map<String, Object> detectDebris(@RequestParam("image") MultipartFile image) throws Exception {

        System.out.println("Received file: " + image.getOriginalFilename());

        // 1. Image ko Python model service ko forward karo
        ByteArrayResource resource = new ByteArrayResource(image.getBytes()) {
            @Override
            public String getFilename() {
                return image.getOriginalFilename();
            }
        };

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        HttpHeaders imagePartHeaders = new HttpHeaders();
        String contentType = image.getContentType();
        if (contentType == null) {
            contentType = "image/jpeg";
        }
        imagePartHeaders.setContentType(MediaType.parseMediaType(contentType));

        HttpEntity<ByteArrayResource> imagePart = new HttpEntity<>(resource, imagePartHeaders);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", imagePart);

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
        RestTemplate restTemplate = new RestTemplate();

        Map<String, Object> pythonResponse = restTemplate.postForObject(PYTHON_MODEL_URL, requestEntity, Map.class);

        System.out.println("Python model response: " + pythonResponse);

        List<Map<String, Object>> rawDetections = (List<Map<String, Object>>) pythonResponse.get("detections");

        // 2. Har detection mein lat/lon aur shadow_check_passed add karo
        List<Map<String, Object>> finalDetections = new ArrayList<>();
        String processedAt = java.time.Instant.now().toString();
        int detectionIdCounter = 1;

        for (Map<String, Object> raw : rawDetections) {
            Map<String, Object> bboxRaw = (Map<String, Object>) raw.get("bbox");
            double xCenter = ((Number) bboxRaw.get("x_center")).doubleValue();
            double yCenter = ((Number) bboxRaw.get("y_center")).doubleValue();
            double confidence = ((Number) raw.get("confidence")).doubleValue();

            // Simple placeholder geotagging: bbox position ko chhote GPS offset mein badalna
            // Real deployment mein ye sonar ke saath aayi actual nav/ping-header file se calculate hoga
            double lat = BASE_LAT + (yCenter - 0.5) * 0.002;
            double lon = BASE_LON + (xCenter - 0.5) * 0.002;

            // Real shadow-check result seedha Python se aa raha hai ab (naya model.zip)
            boolean shadowCheckPassed = (boolean) raw.get("shadow_check_passed");

            Map<String, Object> detection = new HashMap<>();
            detection.put("detection_id", detectionIdCounter++);
            detection.put("class", raw.get("class"));
            detection.put("confidence", confidence);
            detection.put("bbox", bboxRaw);
            detection.put("lat", Math.round(lat * 10000.0) / 10000.0);
            detection.put("lon", Math.round(lon * 10000.0) / 10000.0);
            detection.put("shadow_check_passed", shadowCheckPassed);

            finalDetections.add(detection);

            // 3. Database mein save karo
            ScanResult result = new ScanResult();
            result.setImageId(image.getOriginalFilename());
            result.setClassName((String) raw.get("class"));
            result.setConfidence(confidence);
            result.setLat(lat);
            result.setLon(lon);
            result.setShadowCheckPassed(shadowCheckPassed);
            result.setProcessedAt(processedAt);
            scanResultRepository.save(result);
        }

        // 4. Final response frontend ko bhejo (real processing time bhi Python se aa raha hai)
        Map<String, Object> response = new HashMap<>();
        response.put("image_id", image.getOriginalFilename());
        response.put("processed_at", processedAt);
        response.put("detections", finalDetections);
        response.put("processing_time_seconds", pythonResponse.get("processing_time_seconds"));

        return response;
    }

    @GetMapping("/reports")
    public List<ScanResult> getAllReports() {
        return scanResultRepository.findAll();
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/reports/{id}")
    public Map<String, Object> deleteReport(@org.springframework.web.bind.annotation.PathVariable Long id) {
        Map<String, Object> response = new HashMap<>();
        if (scanResultRepository.existsById(id)) {
            scanResultRepository.deleteById(id);
            response.put("deleted", true);
        } else {
            response.put("deleted", false);
        }
        return response;
    }
}