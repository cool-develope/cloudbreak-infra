export enum EventType {
  Event = 'Event',
  Post = 'Post',
}

export interface Image {
  url: string;
}

export interface File {
  url: string;
}

export interface Event {
  __typename: EventType;
  id: string;
  title: string;
  description: string;
  image: Image;
  startDate: string;
  endDate: string;
  address: string;
  discipline: string;
  price: number;
  likesCount: number;
  viewsCount: number;
}

export interface Post {
  __typename: EventType;
  id: string;
  title: string;
  description: string;
  image: Image;
  attachment: File;
  likesCount: number;
  viewsCount: number;
}

export interface FeedConnection {
  items: (Event | Post)[];
}

export interface FeedFilterInput {
  eventType: EventType;
}
