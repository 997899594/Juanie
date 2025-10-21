import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { GitLabService } from "../../gitlab/gitlab.service";
import {
  createGitlabProjectSchema,
  deleteGitlabProjectSchema,
  forkGitlabProjectSchema,
  getGitlabProjectSchema,
  getUserByUsernameSchema,
  listGroupsSchema,
  listGitlabProjectsSchema,
  searchGitlabProjectsSchema,
} from "../../schemas/gitlab.schema";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const createGitLabRouter = (gitlabService: GitLabService) =>
  createTRPCRouter({
    // 获取当前用户信息
    getCurrentUser: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await gitlabService.getCurrentUser(Number(ctx.session.userId));
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to get current user",
        });
      }
    }),

    // 获取指定用户信息
    getUser: protectedProcedure
      .input(getUserByUsernameSchema)
      .query(async ({ ctx, input }) => {
        try {
          return await gitlabService.getUser(Number(ctx.session.userId), input);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              error instanceof Error ? error.message : "Failed to get user",
          });
        }
      }),

    // 获取群组列表
    listGroups: protectedProcedure
      .input(listGroupsSchema)
      .query(async ({ ctx, input }) => {
        try {
          return await gitlabService.listGroups(Number(ctx.session.userId), input);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              error instanceof Error ? error.message : "Failed to list groups",
          });
        }
      }),

    // 获取项目列表
    listProjects: protectedProcedure
      .input(listGitlabProjectsSchema)
      .query(async ({ ctx, input }) => {
        try {
          return await gitlabService.listProjects(Number(ctx.session.userId), input);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "Failed to list projects",
          });
        }
      }),

    // 获取单个项目
    getProject: protectedProcedure
      .input(getGitlabProjectSchema)
      .query(async ({ ctx, input }) => {
        try {
          return await gitlabService.getProject(Number(ctx.session.userId), input);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              error instanceof Error ? error.message : "Failed to get project",
          });
        }
      }),

    // 创建项目
    createProject: protectedProcedure
      .input(createGitlabProjectSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          return await gitlabService.createProject(Number(ctx.session.userId), input);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "Failed to create project",
          });
        }
      }),

    // 删除项目
    deleteProject: protectedProcedure
      .input(deleteGitlabProjectSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          return await gitlabService.deleteProject(Number(ctx.session.userId), input);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "Failed to delete project",
          });
        }
      }),

    // Fork 项目
    forkProject: protectedProcedure
      .input(forkGitlabProjectSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          return await gitlabService.forkProject(Number(ctx.session.userId), input);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              error instanceof Error ? error.message : "Failed to fork project",
          });
        }
      }),

    // 搜索项目
    searchProjects: protectedProcedure
      .input(searchGitlabProjectsSchema)
      .query(async ({ ctx, input }) => {
        try {
          return await gitlabService.searchProjects(Number(ctx.session.userId), input);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "Failed to search projects",
          });
        }
      }),
  });

export type GitLabRouter = ReturnType<typeof createGitLabRouter>;
