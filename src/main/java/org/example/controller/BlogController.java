// src/main/java/org/example/controller/BlogController.java
package org.example.controller;

import org.example.BlogPost;
import org.example.service.FileStorageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/posts")
@CrossOrigin(origins = "*") // 允许所有来源的跨域请求
public class BlogController {

    @Autowired
    private FileStorageService fileStorageService;

    // 获取所有博客文章
    @GetMapping
    public List<BlogPost> getAllPosts() {
        return fileStorageService.getAllPosts();
    }

    // 根据ID获取单个博客文章
    @GetMapping("/{id}")
    public BlogPost getPost(@PathVariable Long id) {
        return fileStorageService.getPostById(id);
    }

    // 创建新的博客文章
    @PostMapping
    public BlogPost createPost(@RequestBody BlogPost post) {
        return fileStorageService.savePost(post);
    }

    // 更新博客文章
    @PutMapping("/{id}")
    public BlogPost updatePost(@PathVariable Long id, @RequestBody BlogPost post) {
        post.setId(id);
        return fileStorageService.savePost(post);
    }

    // 删除博客文章
    @DeleteMapping("/{id}")
    public void deletePost(@PathVariable Long id) {
        fileStorageService.deletePost(id);
    }
}