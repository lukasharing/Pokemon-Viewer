/*  _-_      _-_      _-__-_   _-__-__-__-__-__-__-__-_
    _-_      _-_      _-__-_   _-__-_      _-__-_
    _-_      _-_      _-__-__-_   _-_      _-__-_
    _-_      _-_      _-__-__-_   _-__-__-__-__-__-__-_
    _-__-__-__-__-__-__-__-_   _-__-_      _-_      _-_
    _-__-__-__-__-__-__-__-_   _-__-_      _-__-__-__-_
    ***************************************************
    ***************************************************
    This content is coded by Lukas Häring García and the
    idea is taken from some other hacking programs.
*/
class NHandler{
  constructor(){
    this.notifications = new Array(); // Stack.
  };

  /*
    Description: Returns last notifiaction.
    Returns: Notifiaction Object.
  */
  get getLastNotification(){ return this.notifications[this.notifications.length - 1]; };

  /*
    Description: Returns date of the last update.
    Returns: Date Object.
  */
  get getLastUpdate(){ return this.getLastNotification().getDate(); };

  /*
    Description:
    Returns:
  */
  pop(_title, _description, _type){
    let notifiaction = new Notification(_title, _description, _type);
    this.notifications.push(notifiaction);
    $("#notification-area").prepend(notifiaction.getHTML());
    let not_html = $("#notification-area > .notification:first");
    setTimeout((e)=>{
      not_html.addClass("visible");
      setTimeout((e)=>{
        not_html.removeClass("visible");
        setTimeout((e)=>{
          not_html.remove();
        }, 500);
      }, 5000);
    }, 100);

  }
};

const NotificationHandler = new NHandler();
