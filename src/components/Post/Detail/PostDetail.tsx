import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  CloseButton,
  Divider,
  Group,
  Stack,
  Text,
  Title,
  createStyles,
  Paper,
  Center,
  Tooltip,
} from '@mantine/core';
import { Availability, CollectionType, EntityCollaboratorStatus, EntityType } from '@prisma/client';
import { IconCheck, IconTrash, IconX } from '@tabler/icons-react';
import { IconDotsVertical, IconBookmark, IconShare3 } from '@tabler/icons-react';
import { truncate } from 'lodash-es';
import Link from 'next/link';
import { NotFound } from '~/components/AppLayout/NotFound';
import { NavigateBack } from '~/components/BackButton/BackButton';
import { useBrowserRouter } from '~/components/BrowserRouter/BrowserRouterProvider';
import { BrowsingModeOverrideProvider } from '~/components/BrowsingLevel/BrowsingLevelProvider';
import { TipBuzzButton } from '~/components/Buzz/TipBuzzButton';
import { ChatUserButton } from '~/components/Chat/ChatUserButton';
import { Collection } from '~/components/Collection/Collection';
import { DaysFromNow } from '~/components/Dates/DaysFromNow';
import {
  useEntityCollaboratorsMutate,
  useGetEntityCollaborators,
} from '~/components/EntityCollaborator/entityCollaborator.util';
import { FollowUserButton } from '~/components/FollowUserButton/FollowUserButton';
import {
  ExplainHiddenImages,
  useExplainHiddenImages,
} from '~/components/Image/ExplainHiddenImages/ExplainHiddenImages';
import { useQueryImages } from '~/components/Image/image.utils';
import { Meta } from '~/components/Meta/Meta';
import { PageLoader } from '~/components/PageLoader/PageLoader';
import { PostComments } from '~/components/Post/Detail/PostComments';
import { PostControls } from '~/components/Post/Detail/PostControls';
import { PostImages } from '~/components/Post/Detail/PostImages';
import { usePostContestCollectionDetails } from '~/components/Post/post.utils';
import { RenderHtml } from '~/components/RenderHtml/RenderHtml';
import { SensitiveShield } from '~/components/SensitiveShield/SensitiveShield';
import { ShareButton } from '~/components/ShareButton/ShareButton';
import { TrackView } from '~/components/TrackView/TrackView';
import { UserAvatar } from '~/components/UserAvatar/UserAvatar';
import { env } from '~/env/client.mjs';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { openContext } from '~/providers/CustomModalsProvider';
import { hasPublicBrowsingLevel } from '~/shared/constants/browsingLevel.constants';
import { toStringList } from '~/utils/array-helpers';
import { containerQuery } from '~/utils/mantine-css-helpers';
import { removeTags } from '~/utils/string-helpers';
import { trpc } from '~/utils/trpc';
import { Fragment } from 'react';
import { ReactionSettingsProvider } from '~/components/Reaction/ReactionSettingsProvider';
import { contestCollectionReactionsHidden } from '~/components/Collections/collection.utils';
import { useHiddenPreferencesData } from '~/hooks/hidden-preferences';

type Props = { postId: number };

export function PostDetail(props: Props) {
  return (
    <BrowsingModeOverrideProvider>
      <PostDetailContent {...props} />
    </BrowsingModeOverrideProvider>
  );
}

export function PostDetailContent({ postId }: Props) {
  const { classes, theme } = useStyles();
  const currentUser = useCurrentUser();
  const { query } = useBrowserRouter();
  const { data: post, isLoading: postLoading } = trpc.post.get.useQuery({ id: postId });
  const {
    flatData: unfilteredImages,
    images,
    isLoading: imagesLoading,
  } = useQueryImages({ postId, pending: true, browsingLevel: undefined });
  const { data: postResources = [] } = trpc.post.getResources.useQuery({ id: postId });
  const { collectionItems = [] } = usePostContestCollectionDetails(
    { id: postId },
    { enabled: !!post?.collectionId }
  );

  const isOwnerOrMod = currentUser?.id === post?.user.id || currentUser?.isModerator;

  const {
    removeEntityCollaborator,
    removingEntityCollaborator,
    actionEntityCollaborator,
    actioningEntityCollaborator,
  } = useEntityCollaboratorsMutate();

  const { collaborators: postCollaborators } = useGetEntityCollaborators({
    entityId: postId,
    entityType: EntityType.Post,
  });

  const hiddenExplained = useExplainHiddenImages(unfilteredImages);
  const { blockedUsers } = useHiddenPreferencesData();
  const alreadyBlocked = blockedUsers.find((u) => u.id === post?.user.id);

  const meta = (
    <Meta
      title={(post?.title ?? `Image post by ${post?.user.username}`) + ' | Civitai'}
      description={
        `A post by ${post?.user.username}. Tagged with ${toStringList(
          post?.tags.map((x) => x.name) ?? []
        )}.` + (post?.detail ? ' ' + truncate(removeTags(post?.detail ?? ''), { length: 100 }) : '')
      }
      images={images}
      links={[{ href: `${env.NEXT_PUBLIC_BASE_URL}/posts/${postId}`, rel: 'canonical' }]}
      deIndex={post?.availability === Availability.Unsearchable}
    />
  );

  if (postLoading) return <PageLoader />;
  if (!post || alreadyBlocked) return <NotFound />;

  if (!currentUser && !hasPublicBrowsingLevel(post.nsfwLevel))
    return (
      <>
        {meta}
        <SensitiveShield />
      </>
    );

  const relatedResource =
    post.modelVersion?.id &&
    postResources.find((resource) => resource.modelVersionId === post.modelVersionId);

  return (
    <>
      {meta}
      <TrackView entityId={post.id} entityType="Post" type="PostView" />
      <ReactionSettingsProvider
        settings={{
          hideReactions: collectionItems.some((ci) =>
            contestCollectionReactionsHidden(ci.collection)
          ),
        }}
      >
        <div className={classes.container}>
          <div className={classes.content}>
            <Stack>
              <Stack spacing={8}>
                <Group spacing="md" position="apart" align="center" noWrap>
                  {post.title && (
                    <Title order={1} lineClamp={2} size={26}>
                      {post.title}
                    </Title>
                  )}
                  {query.dialog && (
                    <NavigateBack url="/posts">
                      {({ onClick }) => <CloseButton onClick={onClick} size="lg" ml="auto" />}
                    </NavigateBack>
                  )}
                </Group>
                <Group position="apart" align="flex-start">
                  <Group spacing="sm">
                    <Text size="xs" color="dimmed">
                      {relatedResource && (
                        <>
                          Posted to{' '}
                          <Link
                            href={`/models/${relatedResource.modelId}?modelVersionId=${relatedResource.modelVersionId}`}
                            passHref
                          >
                            <Anchor>
                              {relatedResource.modelName} - {relatedResource.modelVersionName}
                            </Anchor>
                          </Link>{' '}
                        </>
                      )}
                      {post.publishedAt ? <DaysFromNow date={post.publishedAt} /> : null}
                    </Text>
                    {!!post.tags.length && (
                      <>
                        <Divider
                          orientation="vertical"
                          sx={(theme) => ({
                            [containerQuery.smallerThan('sm')]: { display: 'none' },
                          })}
                        />
                        <Collection
                          items={post.tags}
                          limit={2}
                          badgeProps={{ radius: 'xl', size: 'lg' }}
                          renderItem={(item) => (
                            <Link key={item.id} href={`/posts?tags=${item.id}&view=feed`} passHref>
                              <Badge
                                component="a"
                                color="gray"
                                radius="xl"
                                size="lg"
                                px={8}
                                style={{ cursor: 'pointer' }}
                                variant={theme.colorScheme === 'dark' ? 'filled' : 'light'}
                              >
                                <Text size="xs" transform="capitalize" weight={500}>
                                  {item.name}
                                </Text>
                              </Badge>
                            </Link>
                          )}
                          grouped
                        />
                      </>
                    )}
                  </Group>
                  <Group spacing="xs" position="right" sx={{ flex: '1 0 !important' }} noWrap>
                    <Button
                      size="md"
                      radius="xl"
                      color="gray"
                      variant={theme.colorScheme === 'dark' ? 'filled' : 'light'}
                      leftIcon={<IconBookmark size={14} />}
                      onClick={() =>
                        openContext('addToCollection', {
                          postId: post.id,
                          type: CollectionType.Post,
                        })
                      }
                      compact
                    >
                      <Text size="xs">Save</Text>
                    </Button>
                    <ShareButton
                      url={`/posts/${post.id}`}
                      title={post.title ?? `Post by ${post.user.username}`}
                      collect={{ type: CollectionType.Post, postId: post.id }}
                    >
                      <Button
                        radius="xl"
                        color="gray"
                        variant={theme.colorScheme === 'dark' ? 'filled' : 'light'}
                        size="md"
                        leftIcon={<IconShare3 size={14} />}
                        compact
                      >
                        <Text size="xs">Share</Text>
                      </Button>
                    </ShareButton>
                    <PostControls
                      postId={post.id}
                      userId={post.user.id}
                      isModelVersionPost={post.modelVersionId}
                    >
                      <ActionIcon
                        variant={theme.colorScheme === 'dark' ? 'filled' : 'light'}
                        size={30}
                        radius="xl"
                        sx={(theme) => ({
                          [containerQuery.smallerThan('sm')]: { marginLeft: 'auto' },
                        })}
                      >
                        <IconDotsVertical size={16} />
                      </ActionIcon>
                    </PostControls>
                  </Group>
                </Group>
                <Group mt="sm">
                  <Group spacing="xl">
                    <UserAvatar
                      user={post.user}
                      avatarProps={{ size: 32 }}
                      size="md"
                      subTextSize="sm"
                      textSize="md"
                      withUsername
                      linkToProfile
                    />
                    <Group spacing={8} noWrap>
                      <TipBuzzButton
                        toUserId={post.user.id}
                        entityId={post.id}
                        entityType="Post"
                        size="md"
                        compact
                      />
                      <ChatUserButton user={post.user} size="md" compact />
                      <FollowUserButton userId={post.user.id} size="md" compact />
                    </Group>
                  </Group>
                  {postCollaborators.length > 0 &&
                    postCollaborators.map((collaborator) => {
                      return (
                        <Group key={collaborator.user.id} spacing={4} noWrap>
                          <UserAvatar
                            user={collaborator.user}
                            avatarProps={{ size: 32 }}
                            size="md"
                            subTextSize="sm"
                            textSize="md"
                            withUsername
                            linkToProfile
                          />
                          <Group spacing={4} noWrap>
                            {collaborator.user.id === currentUser?.id &&
                              collaborator.status === EntityCollaboratorStatus.Pending && (
                                <Fragment key={collaborator.user.id}>
                                  <Tooltip label="Accept collaboration">
                                    <ActionIcon
                                      onClick={() => {
                                        actionEntityCollaborator({
                                          entityId: postId,
                                          entityType: EntityType.Post,
                                          status: EntityCollaboratorStatus.Approved,
                                        });
                                      }}
                                      loading={actioningEntityCollaborator}
                                    >
                                      <IconCheck size={20} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="Reject collaboration">
                                    <ActionIcon
                                      onClick={() => {
                                        actionEntityCollaborator({
                                          entityId: postId,
                                          entityType: EntityType.Post,
                                          status: EntityCollaboratorStatus.Rejected,
                                        });
                                      }}
                                      loading={actioningEntityCollaborator}
                                    >
                                      <IconX size={20} />
                                    </ActionIcon>
                                  </Tooltip>
                                </Fragment>
                              )}

                            {isOwnerOrMod && (
                              <Tooltip label="Remove collaborator">
                                <ActionIcon
                                  onClick={() => {
                                    removeEntityCollaborator({
                                      entityId: postId,
                                      entityType: EntityType.Post,
                                      targetUserId: collaborator.user.id,
                                    });
                                  }}
                                  loading={removingEntityCollaborator}
                                  color="red"
                                >
                                  <IconTrash size={20} />
                                </ActionIcon>
                              </Tooltip>
                            )}
                          </Group>
                        </Group>
                      );
                    })}
                </Group>
              </Stack>
              {!imagesLoading && !unfilteredImages?.length ? (
                <Alert>Unable to load images</Alert>
              ) : (
                <>
                  <PostImages
                    postId={post.id}
                    images={images}
                    isLoading={imagesLoading}
                    collectionItems={collectionItems}
                    isOwner={currentUser?.id === post.user.id}
                    isModerator={currentUser?.isModerator}
                  />
                  {hiddenExplained.hasHidden && !imagesLoading && (
                    <Paper component={Center} p="xl" mih={300} withBorder>
                      <ExplainHiddenImages {...hiddenExplained} />
                    </Paper>
                  )}
                </>
              )}
              <Stack spacing="xl" mt="xl" id="comments" mb={90}>
                {post.detail && <RenderHtml html={post.detail} withMentions />}
                <PostComments postId={postId} userId={post.user.id} />
              </Stack>
            </Stack>
          </div>
          {/* <div className={classes.sidebar}>
          <Adunit showRemoveAds {...adsRegistry.postDetailSidebar} />
        </div> */}
        </div>
      </ReactionSettingsProvider>
    </>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    display: 'flex',
    flexDirection: 'column-reverse',
    gap: theme.spacing.md,
    margin: '0 auto',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: theme.spacing.md,
    paddingRight: theme.spacing.md,
    marginBottom: theme.spacing.md,

    [`@media(min-width: ${theme.breakpoints.md}px)`]: {
      alignItems: 'flex-start',
      flexDirection: 'row',
    },
  },
  content: {
    maxWidth: '100%',
    [`@media(min-width: ${theme.breakpoints.md}px)`]: {
      flex: 1,
      maxWidth: 700,
    },
  },
  sidebar: {
    display: 'none',
    [`@media(min-width: ${theme.breakpoints.md}px)`]: {
      display: 'block',
      width: 300,
      position: 'sticky',
      top: theme.spacing.md,
    },
  },
}));
