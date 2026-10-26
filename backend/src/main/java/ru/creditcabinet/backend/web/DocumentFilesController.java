package ru.creditcabinet.backend.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;
import ru.creditcabinet.backend.application.DocumentCatalog;
import ru.creditcabinet.backend.auth.Principal;
import ru.creditcabinet.backend.common.ApiException;
import ru.creditcabinet.backend.profiles.HttpDocumentCatalog.DocumentDto;
import java.io.IOException;
import java.time.Duration;

@RestController
@RequestMapping("/api/documents")
public class DocumentFilesController {
    private final DocumentCatalog documents;
    private final RestClient client;
    private final boolean configured;
    public DocumentFilesController(DocumentCatalog documents, @Value("${app.documents-url:}") String url,
                                   @Value("${app.documents-token:}") String token) {
        this.documents=documents; this.configured=!url.isBlank() && !token.isBlank();
        var factory=new SimpleClientHttpRequestFactory(); factory.setConnectTimeout(Duration.ofSeconds(2)); factory.setReadTimeout(Duration.ofSeconds(15));
        client=RestClient.builder().baseUrl(url.isBlank()?"http://localhost:8002":url).defaultHeader("Authorization","Bearer "+token).requestFactory(factory).build();
    }
    private void available() { if(!configured) throw new ApiException(503,"documents_unavailable","Сервис документов не подключён",java.util.List.of()); }
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public DocumentDto upload(Principal p, @RequestParam MultipartFile file, @RequestParam String type,
                              @RequestParam String title, @RequestParam(defaultValue="") String periodFrom,
                              @RequestParam(defaultValue="") String periodTo) throws IOException {
        p.requireClient(); available();
        if(file.isEmpty() || file.getSize()>20*1024*1024) throw ApiException.validation("file","Требуется PDF до 20 МБ");
        byte[] bytes=file.getBytes();
        if(bytes.length<5 || !new String(bytes,0,5,java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-")) throw ApiException.validation("file","Требуется PDF-файл");
        var body=new LinkedMultiValueMap<String,Object>();
        body.add("file",new ByteArrayResource(bytes) { @Override public String getFilename() { return "document.pdf"; } });
        body.add("type",type); body.add("title",title); body.add("periodFrom",periodFrom); body.add("periodTo",periodTo);
        return client.post().uri("/companies/{inn}/documents",p.companyInn()).contentType(MediaType.MULTIPART_FORM_DATA).body(body)
                .retrieve().onStatus(HttpStatusCode::is4xxClientError,(req,res) -> { throw ApiException.validation("file","Проверьте тип документа, название, период и PDF-файл"); })
                .onStatus(HttpStatusCode::is5xxServerError,(req,res) -> { throw new ApiException(503,"documents_unavailable","Сервис документов недоступен",java.util.List.of()); })
                .body(DocumentDto.class);
    }
    @GetMapping("/{id}/file")
    public ResponseEntity<byte[]> download(Principal p,@PathVariable String id) {
        p.requireClient(); available();
        documents.find(p.companyInn(),id).orElseThrow(() -> ApiException.notFound("Документ не найден"));
        byte[] bytes=client.get().uri("/companies/{inn}/documents/{id}/file",p.companyInn(),id).retrieve()
                .onStatus(HttpStatusCode::is4xxClientError,(req,res) -> { throw ApiException.notFound("Файл не найден"); }).body(byte[].class);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=\"document.pdf\"").body(bytes);
    }
}
