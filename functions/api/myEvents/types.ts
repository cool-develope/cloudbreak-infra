export interface Image {
  url: string;
}

export interface Event {
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
  acceptedCount: number;
  author?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    photo?: Image;
  };
}

export interface MyEventsConnection {
  items: Event[];
  totalCount: number;
}
