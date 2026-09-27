package com.example.lms.course_authoring.infrastructure.persistence;

import com.example.lms.course_authoring.domain.model.Course;
import com.example.lms.course_authoring.infrastructure.persistence.mapper.CourseEntityMapper;
import com.example.lms.identity.infrastructure.persistence.repository.UserJpaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseRepositoryImplPagingTest {
    @Mock JpaCourseRepository jpa;
    @Mock CourseEntityMapper mapper;
    @Mock UserJpaRepository users;
    CourseRepositoryImpl repository;

    final Pageable entityPage = PageRequest.of(2, 7,
            Sort.by(Sort.Order.asc("status"), Sort.Order.desc("createdAt")));
    final Pageable sqlPage = PageRequest.of(2, 7,
            Sort.by(Sort.Order.asc("status"), Sort.Order.desc("created_at")));

    @BeforeEach
    void setUp() { repository = new CourseRepositoryImpl(jpa, mapper, users); }

    @Test
    void adminTitleSearchUsesSqlColumnsAndPreservesPageAndSortDirection() {
        when(jpa.findByTitleContaining(eq("STCW"), any())).thenReturn(Page.empty());
        repository.findByTitleContaining("STCW", entityPage);
        verify(jpa).findByTitleContaining("STCW", sqlPage);
    }

    @Test
    void approvedTitleSearchUsesSqlColumns() {
        when(jpa.findByStatusAndTitleContaining(eq("APPROVED"), eq("STCW"), any()))
                .thenReturn(Page.empty());
        repository.findByStatusAndTitleContaining(Course.CourseStatus.APPROVED, "STCW", entityPage);
        verify(jpa).findByStatusAndTitleContaining("APPROVED", "STCW", sqlPage);
    }

    @Test
    void pendingReviewUsesSqlColumns() {
        when(jpa.findReviewQueue(any())).thenReturn(Page.empty());
        repository.findReviewQueue(entityPage);
        verify(jpa).findReviewQueue(sqlPage);
    }

    @Test
    void unfilteredJpaQueryRetainsEntityProperties() {
        when(jpa.findAll(any(Pageable.class))).thenReturn(Page.empty());
        repository.findAll(entityPage);
        verify(jpa).findAll(entityPage);
    }
}
