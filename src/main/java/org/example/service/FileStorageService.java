// src/main/java/org/example/service/FileStorageService.java
package org.example.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.BlogPost;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class FileStorageService {

    private static final String DATA_FILE = "blog_data.json";
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AtomicLong idGenerator = new AtomicLong(1);
    private List<BlogPost> posts = new ArrayList<>();

    @PostConstruct
    public void init() {
        loadPostsFromFile();
    }

    public List<BlogPost> getAllPosts() {
        return new ArrayList<>(posts);
    }

    public BlogPost getPostById(Long id) {
        return posts.stream()
                .filter(post -> post.getId().equals(id))
                .findFirst()
                .orElse(null);
    }

    public BlogPost savePost(BlogPost post) {
        if (post.getId() == null) {
            post.setId(idGenerator.getAndIncrement());
            post.setCreatedAt(LocalDateTime.now());
        }
        posts.removeIf(p -> p.getId().equals(post.getId()));
        posts.add(post);
        savePostsToFile();
        return post;
    }

    public boolean deletePost(Long id) {
        boolean removed = posts.removeIf(post -> post.getId().equals(id));
        if (removed) {
            savePostsToFile();
        }
        return removed;
    }

    private void loadPostsFromFile() {
        File file = new File(DATA_FILE);
        if (file.exists()) {
            try {
                posts = objectMapper.readValue(file, new TypeReference<List<BlogPost>>() {});
                // 更新 ID 生成器
                long maxId = posts.stream()
                        .mapToLong(BlogPost::getId)
                        .max()
                        .orElse(0);
                idGenerator.set(maxId + 1);
            } catch (IOException e) {
                System.err.println("读取数据文件失败: " + e.getMessage());
                posts = new ArrayList<>();
            }
        } else {
            posts = new ArrayList<>();
        }
    }

    private void savePostsToFile() {
        try {
            objectMapper.writeValue(new File(DATA_FILE), posts);
        } catch (IOException e) {
            System.err.println("保存数据文件失败: " + e.getMessage());
        }
    }
}