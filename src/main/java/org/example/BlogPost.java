// src/main/java/org/example/BlogPost.java
package org.example;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class BlogPost {
    private Long id;
    private String title;
    private String content;
    private String author;
    private LocalDateTime createdAt;

    // 无参构造函数
    public BlogPost() {
    }

    // 有参构造函数
    public BlogPost(String title, String content, String author) {
        this.title = title;
        this.content = content;
        this.author = author;
        this.createdAt = LocalDateTime.now();
    }
}